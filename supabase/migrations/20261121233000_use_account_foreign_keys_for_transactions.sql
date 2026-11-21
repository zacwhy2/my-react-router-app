begin;

do $$
begin
  if exists (
    select 1
    from public.txns1 t
    where t.from_account_id is null
      and (
        select count(*)
        from public.accounts a
        where lower(btrim(a.name)) = lower(btrim(t."from"))
      ) > 1
  ) then
    raise exception 'Some transaction From values match multiple accounts. Rename duplicate accounts before applying this migration.';
  end if;

  if exists (
    select 1
    from public.txns1 t
    where t.to_account_id is null
      and (
        select count(*)
        from public.accounts a
        where lower(btrim(a.name)) = lower(btrim(t."to"))
      ) > 1
  ) then
    raise exception 'Some transaction To values match multiple accounts. Rename duplicate accounts before applying this migration.';
  end if;
end;
$$;

update public.txns1 t
set from_account_id = (
  select a.id
  from public.accounts a
  where lower(btrim(a.name)) = lower(btrim(t."from"))
)
where t.from_account_id is null;

update public.txns1 t
set to_account_id = (
  select a.id
  from public.accounts a
  where lower(btrim(a.name)) = lower(btrim(t."to"))
)
where t.to_account_id is null;

do $$
begin
  if exists (
    select 1
    from public.txns1
    where from_account_id is null or to_account_id is null
  ) then
    raise exception 'Some transactions do not match an account. Create or rename accounts so every From and To value matches an account, then retry.';
  end if;
end;
$$;

alter table public.txns1
  alter column from_account_id set not null,
  alter column to_account_id set not null,
  drop column "from",
  drop column "to";

commit;
