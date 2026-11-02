-- Security hardening. Paste this whole file into Supabase > SQL Editor and press "Run" once. Running it again is harmless.

-- 1. The News Hunter's tables: only the website's server key may touch them (they were already protected by row-level
--    security; this removes the default permissions of the public keys as well, like the other tables).
revoke all on hunter_pages, hunter_items, hunter_drafts, hunter_runs from anon, authenticated;

-- 2. Counters for "too many tries" limits (sign-in, newsletter, poll, phone alerts).
create table if not exists rate_limits (
  k text primary key,
  n int not null,
  reset_at timestamptz not null
);
alter table rate_limits enable row level security;
revoke all on rate_limits from anon, authenticated;
grant select, insert, update, delete on rate_limits to service_role;

-- Adds one use of p_key and returns how many uses there have been in the current window of p_window seconds.
create or replace function hit_rate_limit(p_key text, p_window int) returns int
language plpgsql as $$
declare
  c int;
begin
  insert into rate_limits as r (k, n, reset_at) values (p_key, 1, now() + make_interval(secs => p_window))
  on conflict (k) do update set
    n = case when r.reset_at <= now() then 1 else r.n + 1 end,
    reset_at = case when r.reset_at <= now() then now() + make_interval(secs => p_window) else r.reset_at end
  returning r.n into c;
  if random() < 0.02 then delete from rate_limits where reset_at < now() - interval '1 day'; end if;
  return c;
end $$;
revoke all on function hit_rate_limit(text, int) from public, anon, authenticated;
grant execute on function hit_rate_limit(text, int) to service_role;

-- 3. CHECK (read-only): this lists every table, whether row-level security is on, and whether the public keys
--    "anon" and "authenticated" have ANY permission on it. Every row should show rls_on = true and public_access = false.
select c.relname as table_name,
       c.relrowsecurity as rls_on,
       exists (select 1 from information_schema.role_table_grants g
               where g.table_schema = 'public' and g.table_name = c.relname and g.grantee in ('anon', 'authenticated')) as public_access
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;
