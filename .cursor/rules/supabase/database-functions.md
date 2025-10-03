---
# Specify the following for Cursor rules
description: Guidelines for writing Supabase database functions
alwaysApply: false
---

# Database: Create functions

You're a Supabase Postgres expert in writing database functions. Generate **high-quality PostgreSQL functions** that adhere to the following best practices:

## General Guidelines

1. **Default to `SECURITY INVOKER`:**
   - Functions should run with the permissions of the user invoking the function, ensuring safer access control.
   - Use `SECURITY DEFINER` only when explicitly required and explain the rationale.

2. **Set the `search_path` Configuration Parameter:**
   - Always set `search_path` to an empty string (`set search_path = '';`).
   - This avoids unexpected behavior and security risks caused by resolving object references in untrusted or unintended schemas.
   - Use fully qualified names (e.g., `schema_name.table_name`) for all database objects referenced within the function.

3. **Adhere to SQL Standards and Validation:**
   - Ensure all queries within the function are valid PostgreSQL SQL queries and compatible with the specified context (ie. Supabase).

## Best Practices

1. **Minimize Side Effects:**
   - Prefer functions that return results over those that modify data unless they serve a specific purpose (e.g., triggers).

2. **Use Explicit Typing:**
   - Clearly specify input and output types, avoiding ambiguous or loosely typed parameters.

3. **Default to Immutable or Stable Functions:**
   - Where possible, declare functions as `IMMUTABLE` or `STABLE` to allow better optimization by PostgreSQL. Use `VOLATILE` only if the function modifies data or has side effects.

4. **Triggers (if Applicable):**
   - If the function is used as a trigger, include a valid `CREATE TRIGGER` statement that attaches the function to the desired table and event (e.g., `BEFORE INSERT`).

## Example Templates

### Simple Function with `SECURITY INVOKER`

```sql
create or replace function my_schema.hello_world()
returns text
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return 'hello world';
end;
$$;
```

### Function with Parameters and Fully Qualified Object Names

```sql
create or replace function public.calculate_total_price(order_id bigint)
returns numeric
language plpgsql
security invoker
set search_path = ''
as $$
declare
  total numeric;
begin
  select sum(price * quantity)
  into total
  from public.order_items
  where order_id = calculate_total_price.order_id;
  
  return total;
end;
$$;
```

### Function as a Trigger

```sql
create or replace function my_schema.update_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Update the "updated_at" column on row modification
  new.updated_at := now();
  return new;
end;
$$;

create trigger update_updated_at_trigger
before update on my_schema.my_table
for each row
execute function my_schema.update_updated_at();
```

### Function with Error Handling

```sql
create or replace function my_schema.safe_divide(numerator numeric, denominator numeric)
returns numeric
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if denominator = 0 then
    raise exception 'Division by zero is not allowed';
  end if;
  
  return numerator / denominator;
end;
$$;
```

### Immutable Function for Better Optimization

```sql
create or replace function my_schema.full_name(first_name text, last_name text)
returns text
language sql
security invoker
set search_path = ''
immutable
as $$
  select first_name || ' ' || last_name;
$$;
```

## Security Considerations

### SECURITY INVOKER vs SECURITY DEFINER

- **SECURITY INVOKER (Default):** Function runs with the privileges of the user calling it
  - Safer default option
  - User must have appropriate permissions on accessed objects
  - Recommended for most functions

- **SECURITY DEFINER:** Function runs with privileges of the user who created it
  - Use sparingly and only when necessary
  - Useful for functions that need elevated privileges
  - Must be carefully reviewed for security implications
  - Always set `search_path = ''` to prevent search path attacks

### Search Path Security

Always use fully qualified names and set empty search_path:

```sql
-- ❌ Incorrect - vulnerable to search path attacks
create or replace function get_user_count()
returns bigint
language sql
as $$
  select count(*) from users;  -- Which schema's users table?
$$;

-- ✅ Correct - safe and explicit
create or replace function public.get_user_count()
returns bigint
language sql
security invoker
set search_path = ''
as $$
  select count(*) from public.users;  -- Explicitly public.users
$$;
```

## Function Volatility Categories

Choose the appropriate volatility category for better performance:

- **IMMUTABLE:** Function always returns same result for same inputs
  ```sql
  create or replace function multiply(a int, b int)
  returns int
  language sql
  immutable
  as $$ select a * b; $$;
  ```

- **STABLE:** Function returns same result for same inputs within a single query
  ```sql
  create or replace function get_current_user_id()
  returns uuid
  language sql
  stable
  set search_path = ''
  as $$ select auth.uid(); $$;
  ```

- **VOLATILE:** Function can return different results or has side effects
  ```sql
  create or replace function create_audit_log()
  returns void
  language plpgsql
  volatile
  set search_path = ''
  as $$
  begin
    insert into public.audit_log (created_at) values (now());
  end;
  $$;
  ```

## Best Practices Checklist

When generating database functions, ensure:

- ✅ Use `SECURITY INVOKER` by default
- ✅ Always set `search_path = ''`
- ✅ Use fully qualified names (schema.table)
- ✅ Specify explicit input/output types
- ✅ Choose appropriate volatility (IMMUTABLE/STABLE/VOLATILE)
- ✅ Include error handling where appropriate
- ✅ Add triggers with `CREATE TRIGGER` statements
- ✅ Minimize side effects when possible
- ✅ Document security considerations for SECURITY DEFINER
- ❌ Never use bare table names without schema
- ❌ Never omit search_path setting
- ❌ Never use SECURITY DEFINER without justification

