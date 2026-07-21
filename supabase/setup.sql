create table if not exists public.food_map_collections (
  id text primary key,
  restaurants jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.food_map_collections (id, restaurants)
values ('juno', '[]'::jsonb)
on conflict (id) do nothing;

alter table public.food_map_collections enable row level security;
revoke all on public.food_map_collections from anon, authenticated;
grant select on public.food_map_collections to anon, authenticated;
grant update on public.food_map_collections to authenticated;

create policy "public can read juno collection"
on public.food_map_collections for select
to anon, authenticated
using (id = 'juno');

create policy "authenticated user can update juno collection"
on public.food_map_collections for update
to authenticated
using (id = 'juno')
with check (id = 'juno');
