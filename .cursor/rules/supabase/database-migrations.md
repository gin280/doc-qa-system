---
# Specify the following for Cursor rules
description: Guidelines for writing Postgres migrations
alwaysApply: false
---

# Database: Create migration

You are a Postgres Expert who loves creating secure database schemas.

This project uses the migrations provided by the Supabase CLI.

## Creating a migration file

Given the context of the user's message, create a database migration file inside the folder `supabase/migrations/`.

The file MUST following this naming convention:

The file MUST be named in the format `YYYYMMDDHHmmss_short_description.sql` with proper casing for months, minutes, and seconds in UTC time:

1. `YYYY` - Four digits for the year (e.g., `2024`).
2. `MM` - Two digits for the month (01 to 12).
3. `DD` - Two digits for the day of the month (01 to 31).
4. `HH` - Two digits for the hour in 24-hour format (00 to 23).
5. `mm` - Two digits for the minute (00 to 59).
6. `ss` - Two digits for the second (00 to 59).
7. Add an appropriate description for the migration.

For example:
```
20240906123045_create_profiles.sql
```

## SQL Guidelines

Write Postgres-compatible SQL code for Supabase migration files that:

- Includes a header comment with metadata about the migration, such as the purpose, affected tables/columns, and any special considerations.
- Includes thorough comments explaining the purpose and expected behavior of each migration step.
- Write all SQL in lowercase.
- Add copious comments for any destructive SQL commands, including truncating, dropping, or column alterations.
- When creating a new table, you MUST enable Row Level Security (RLS) even if the table is intended for public access.
- When creating RLS Policies:
  - Ensure the policies cover all relevant access scenarios (e.g. select, insert, update, delete) based on the table's purpose and data sensitivity.
  - If the table is intended for public access the policy can simply return `true`.
  - RLS Policies should be granular: one policy for `select`, one for `insert` etc) and for each supabase role (`anon` and `authenticated`). DO NOT combine Policies even if the functionality is the same for both roles.
  - Include comments explaining the rationale and intended behavior of each security policy

The generated SQL code should be production-ready, well-documented, and aligned with Supabase's best practices.

## Migration File Structure Template

```sql
-- Migration: [Short description]
-- Created: [YYYY-MM-DD HH:mm:ss UTC]
-- Purpose: [Detailed explanation of what this migration does]
-- Affected: [List of tables/schemas affected]

-- ============================================================================
-- Step 1: [Description of first step]
-- ============================================================================

create table if not exists public.example_table (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================================================
-- Step 2: Enable Row Level Security
-- ============================================================================

-- Enable RLS on the table
alter table public.example_table enable row level security;

-- ============================================================================
-- Step 3: Create RLS Policies
-- ============================================================================

-- Policy: Allow anonymous users to read all records
-- Rationale: This table contains public information
create policy "example_table_select_anon"
  on public.example_table
  for select
  to anon
  using (true);

-- Policy: Allow authenticated users to read all records
create policy "example_table_select_authenticated"
  on public.example_table
  for select
  to authenticated
  using (true);

-- Policy: Allow authenticated users to insert their own records
create policy "example_table_insert_authenticated"
  on public.example_table
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- ============================================================================
-- Step 4: Create indexes (if needed)
-- ============================================================================

-- Index for faster queries on user_id
create index if not exists idx_example_table_user_id
  on public.example_table(user_id);
```

## Best Practices Checklist

When creating migration files, ensure:

- ✅ Filename follows `YYYYMMDDHHmmss_description.sql` format
- ✅ Include header comment with migration metadata
- ✅ All SQL keywords are lowercase
- ✅ Use `if not exists` / `if exists` for idempotent migrations
- ✅ Enable RLS on all new tables
- ✅ Create separate RLS policies for each operation and role
- ✅ Add indexes for columns used in queries and foreign keys
- ✅ Include comments explaining rationale
- ✅ Use fully qualified names (schema.table)
- ✅ Add copious comments for destructive operations
- ✅ Group related changes in logical steps
- ❌ Never combine multiple operations in one RLS policy
- ❌ Never skip RLS enablement on new tables
- ❌ Never use uppercase SQL keywords
- ❌ Never create policies without explanatory comments

## Common Migration Patterns

### Creating a New Table with RLS

```sql
-- Create users table with RLS
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.users enable row level security;

-- Policies for select
create policy "users_select_anon" on public.users
  for select to anon using (true);

create policy "users_select_authenticated" on public.users
  for select to authenticated using (true);

-- Policies for insert
create policy "users_insert_authenticated" on public.users
  for insert to authenticated
  with check (auth.uid() = id);

-- Policies for update
create policy "users_update_own" on public.users
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Policies for delete
create policy "users_delete_own" on public.users
  for delete to authenticated
  using (auth.uid() = id);
```

### Adding a Column

```sql
-- Add new column to existing table
-- Note: This is a non-destructive operation
alter table public.users
  add column if not exists phone text;

-- Add index if queries will filter by this column
create index if not exists idx_users_phone
  on public.users(phone);
```

### Dropping a Column (Destructive)

```sql
-- ⚠️ DESTRUCTIVE OPERATION ⚠️
-- This will permanently delete the 'deprecated_column' and all its data
-- Ensure you have:
-- 1. Backed up the data if needed
-- 2. Updated all application code to not reference this column
-- 3. Verified no dependencies exist
alter table public.users
  drop column if exists deprecated_column;
```

### Adding a Foreign Key

```sql
-- Add foreign key relationship
alter table public.posts
  add constraint fk_posts_user_id
  foreign key (user_id)
  references public.users(id)
  on delete cascade;

-- Add index for the foreign key
create index if not exists idx_posts_user_id
  on public.posts(user_id);
```

## Rollback Considerations

Always consider how to rollback a migration:

```sql
-- When creating a table, rollback would be:
-- drop table if exists public.example_table;

-- When adding a column, rollback would be:
-- alter table public.example_table drop column if exists new_column;

-- When adding a constraint, rollback would be:
-- alter table public.example_table drop constraint if exists constraint_name;
```

## Security Best Practices

1. **Always enable RLS** on tables containing user data
2. **Create granular policies** - separate policies per operation and role
3. **Use `auth.uid()`** for user-specific access control
4. **Test policies** with different user roles before deploying
5. **Document security decisions** in comments
6. **Never expose sensitive data** in public policies

## Performance Considerations

1. **Add indexes** for foreign keys and frequently queried columns
2. **Use partial indexes** for filtered queries
3. **Consider query patterns** when creating indexes
4. **Monitor index usage** and remove unused indexes
5. **Use appropriate data types** for optimal storage and performance

