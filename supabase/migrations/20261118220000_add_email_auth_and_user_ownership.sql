begin;

alter table public.todos
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.txns1
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

do $$
declare
  owner_id uuid;
begin
  select id
  into owner_id
  from auth.users
  where lower(email) = lower('zacwhy@gmail.com')
  limit 1;

  if owner_id is null then
    raise exception 'Sign in once as zacwhy@gmail.com before running this migration so the existing records can be assigned to that account.';
  end if;

  update public.todos set user_id = owner_id where user_id is null;
  update public.txns1 set user_id = owner_id where user_id is null;
end;
$$;

alter table public.todos
  alter column user_id set default auth.uid(),
  alter column user_id set not null;

alter table public.txns1
  alter column user_id set default auth.uid(),
  alter column user_id set not null;

alter table public.todos enable row level security;
alter table public.txns1 enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('todos', 'txns1')
  loop
    execute format(
      'drop policy %I on %I.%I',
      existing_policy.policyname,
      existing_policy.schemaname,
      existing_policy.tablename
    );
  end loop;
end;
$$;

revoke all on table public.todos, public.txns1 from anon, public;
grant select, insert, update, delete on table public.todos, public.txns1 to authenticated;

create policy "Users manage their own todos"
  on public.todos
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their own transactions"
  on public.txns1
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
