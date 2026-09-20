-- Pipeline isolation. Safe to re-run after creating public.pipelines.
alter table public.pipelines enable row level security;
drop policy if exists "pipelines_select_own" on public.pipelines;
drop policy if exists "pipelines_insert_own" on public.pipelines;
drop policy if exists "pipelines_update_own" on public.pipelines;
drop policy if exists "pipelines_delete_own" on public.pipelines;
create policy "pipelines_select_own" on public.pipelines for select using (auth.uid() = user_id);
create policy "pipelines_insert_own" on public.pipelines for insert with check (auth.uid() = user_id);
create policy "pipelines_update_own" on public.pipelines for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "pipelines_delete_own" on public.pipelines for delete using (auth.uid() = user_id);

create table if not exists public.agent_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null, window_start timestamptz not null, used integer not null,
  primary key (user_id, bucket, window_start)
);
alter table public.agent_rate_limits enable row level security;
revoke all on public.agent_rate_limits from anon, authenticated;
create or replace function public.reserve_agent_request(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); slot timestamptz; reserved boolean;
begin
  if uid is null or p_limit < 1 or p_window_seconds <> 60 then return false; end if;
  slot := date_trunc('minute', now());
  insert into agent_rate_limits(user_id,bucket,window_start,used) values(uid,p_bucket,slot,1)
  on conflict(user_id,bucket,window_start) do update set used=agent_rate_limits.used+1 where agent_rate_limits.used < p_limit
  returning true into reserved;
  return coalesce(reserved,false);
end $$;
revoke all on function public.reserve_agent_request(text,integer,integer) from public, anon;
grant execute on function public.reserve_agent_request(text,integer,integer) to authenticated;
