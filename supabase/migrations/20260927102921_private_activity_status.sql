-- Presence/Broadcast больше не публикуются в общий Realtime. Для строгого
-- отзыва доступа проверяем пару при каждом чтении краткоживущего статуса.
create table private.user_activity (
  user_id uuid primary key references auth.users(id) on delete cascade,
  seen_at timestamptz not null default now()
);
create table private.typing_activity (
  sender_id uuid references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  until_at timestamptz not null,
  primary key(sender_id,recipient_id)
);
alter table private.user_activity enable row level security;
alter table private.typing_activity enable row level security;
revoke all on private.user_activity,private.typing_activity from public,anon,authenticated;
create function private.activity_write(recipient uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid := private.photo_actor();
begin
  if exists(select 1 from private.profile_photos where owner_id=actor and deleting) then raise exception 'account deletion in progress'; end if;
  if recipient is not null then
    if private.photo_blocked(actor,recipient)
      or not exists(select 1 from public.likes where liker_id=actor and liked_id=recipient)
      or not exists(select 1 from public.likes where liker_id=recipient and liked_id=actor)
      then raise exception 'recipient unavailable' using errcode='42501'; end if;
    insert into private.typing_activity values(actor,recipient,now()+interval '6 seconds')
      on conflict(sender_id,recipient_id) do update set until_at=excluded.until_at;
  end if;
  insert into private.user_activity values(actor,now()) on conflict(user_id) do update set seen_at=excluded.seen_at;
  update public.profiles set last_seen_at=now() where user_id=actor;
end $$;
create function private.activity_read() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := private.photo_actor(); result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('user_id',l.liked_id,
    'online',coalesce(a.seen_at>now()-interval '45 seconds',false),
    'typing',coalesce(t.until_at>now(),false))),'[]'::jsonb) into result
  from public.likes l
  left join private.user_activity a on a.user_id=l.liked_id
  left join private.typing_activity t on t.sender_id=l.liked_id and t.recipient_id=actor
  where l.liker_id=actor and exists(select 1 from public.likes r where r.liker_id=l.liked_id and r.liked_id=actor)
    and not private.photo_blocked(actor,l.liked_id)
    and not exists(select 1 from private.profile_photos p where p.owner_id=l.liked_id and p.deleting);
  return result;
end $$;
create function public.activity_write(recipient uuid default null) returns void language sql security invoker set search_path='' as $$ select private.activity_write(recipient) $$;
create function public.activity_read() returns jsonb language sql security invoker set search_path='' as $$ select private.activity_read() $$;
revoke all on function private.activity_write(uuid),private.activity_read(),public.activity_write(uuid),public.activity_read() from public,anon,authenticated;
grant execute on function private.activity_write(uuid),private.activity_read(),public.activity_write(uuid),public.activity_read() to authenticated;
