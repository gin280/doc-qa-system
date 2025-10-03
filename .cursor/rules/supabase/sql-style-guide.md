---
# Specify the following for Cursor rules
description: Guidelines for writing Postgres SQL
alwaysApply: true
---

# Postgres SQL Style Guide

## General

- Use lowercase for SQL reserved words to maintain consistency and readability.
- Employ consistent, descriptive identifiers for tables, columns, and other database objects.
- Use white space and indentation to enhance the readability of your code.
- Store dates in ISO 8601 format (`yyyy-mm-ddThh:mm:ss.sssss`).
- Include comments for complex logic, using '/* ... */' for block comments and '--' for line comments.

## Naming Conventions

- Avoid SQL reserved words and ensure names are unique and under 63 characters.
- Use snake_case for tables and columns.
- Prefer plurals for table names
- Prefer singular names for columns.

## Tables

- Avoid prefixes like 'tbl_' and ensure no table name matches any of its column names.
- Always add an `id` column of type `identity generated always` unless otherwise specified.
- Create all tables in the `public` schema unless otherwise specified.
- Always add the schema to SQL queries for clarity.
- Always add a comment to describe what the table does. The comment can be up to 1024 characters.

## Columns

- Use singular names and avoid generic names like 'id'.
- For references to foreign tables, use the singular of the table name with the `_id` suffix. For example `user_id` to reference the `users` table
- Always use lowercase except in cases involving acronyms or when readability would be enhanced by an exception.

### Examples:

```sql
create table books (
  id bigint generated always as identity primary key,
  title text not null,
  author_id bigint references authors (id)
);

comment on table books is 'A list of all the books in the library.';
```

## Queries

- When the query is shorter keep it on just a few lines. As it gets larger start adding newlines for readability
- Add spaces for readability.

Smaller queries:

```sql
select *
from employees
where end_date is null;

update employees
set end_date = '2023-12-31'
where employee_id = 1001;
```

Larger queries:

```sql
select
  first_name,
  last_name
from
  employees
where
  start_date between '2021-01-01' and '2021-12-31'
and
  status = 'employed';
```

## Joins and Subqueries

- Format joins and subqueries for clarity, aligning them with related SQL clauses.
- Prefer full table names when referencing tables. This helps for readability.

```sql
select
  employees.employee_name,
  departments.department_name
from
  employees
join
  departments on employees.department_id = departments.department_id
where
  employees.start_date > '2022-01-01';
```

## Aliases

- Use meaningful aliases that reflect the data or transformation applied, and always include the 'as' keyword for clarity.

```sql
select count(*) as total_employees
from employees
where end_date is null;
```

## Complex queries and CTEs

- If a query is extremely complex, prefer a CTE.
- Make sure the CTE is clear and linear. Prefer readability over performance.
- Add comments to each block.

```sql
with department_employees as (
  -- Get all employees and their departments
  select
    employees.department_id,
    employees.first_name,
    employees.last_name,
    departments.department_name
  from
    employees
  join
    departments on employees.department_id = departments.department_id
),
employee_counts as (
  -- Count how many employees in each department
  select
    department_name,
    count(*) as num_employees
  from
    department_employees
  group by
    department_name
)
select
  department_name,
  num_employees
from
  employee_counts
order by
  department_name;
```

## Style Checklist

When writing SQL, ensure:

- ✅ All SQL keywords are lowercase
- ✅ Use snake_case for identifiers
- ✅ Table names are plural (e.g., `users`, `posts`)
- ✅ Column names are singular (e.g., `user_id`, `title`)
- ✅ Foreign keys use `_id` suffix (e.g., `author_id`)
- ✅ Always use `as` keyword for aliases
- ✅ Add comments to tables and complex logic
- ✅ Include schema prefix in queries (e.g., `public.users`)
- ✅ Use ISO 8601 format for dates
- ✅ Prefer CTEs for complex queries
- ✅ Add appropriate whitespace and indentation
- ❌ Never use table prefixes like 'tbl_'
- ❌ Never use uppercase SQL keywords
- ❌ Never omit schema prefix in production code
- ❌ Never use generic column names without context

## Common Patterns

### Creating a Table with Foreign Key

```sql
create table public.posts (
  id bigint generated always as identity primary key,
  title text not null,
  content text,
  author_id bigint not null references public.users(id) on delete cascade,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

comment on table public.posts is 'Blog posts created by users. Each post belongs to one author.';
```

### Query with Multiple Joins

```sql
select
  posts.title,
  users.username as author_name,
  categories.name as category_name,
  count(comments.id) as comment_count
from
  public.posts
join
  public.users on posts.author_id = users.id
join
  public.categories on posts.category_id = categories.id
left join
  public.comments on posts.id = comments.post_id
where
  posts.published = true
and
  posts.created_at > '2024-01-01'
group by
  posts.id,
  posts.title,
  users.username,
  categories.name
order by
  posts.created_at desc;
```

### Using CTE for Aggregation

```sql
with user_post_counts as (
  -- Calculate total posts per user
  select
    author_id,
    count(*) as post_count
  from
    public.posts
  where
    published = true
  group by
    author_id
),
top_authors as (
  -- Get top 10 authors by post count
  select
    users.username,
    user_post_counts.post_count
  from
    user_post_counts
  join
    public.users on user_post_counts.author_id = users.id
  order by
    user_post_counts.post_count desc
  limit 10
)
select
  username,
  post_count
from
  top_authors
order by
  post_count desc;
```

## Performance Considerations

- Use CTEs for readability, but be aware they may not always be the most performant
- Add appropriate indexes for columns used in WHERE, JOIN, and ORDER BY clauses
- Use EXPLAIN ANALYZE to understand query performance
- Consider materialized views for complex aggregations
- Use appropriate column types to minimize storage

## Security Best Practices

- Always use parameterized queries to prevent SQL injection
- Never store sensitive data in plain text
- Use RLS (Row Level Security) for multi-tenant applications
- Avoid dynamic SQL when possible
- Always qualify table names with schema
- Use appropriate column constraints (NOT NULL, CHECK, etc.)

