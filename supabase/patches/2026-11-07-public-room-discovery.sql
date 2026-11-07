-- مؤسسة إحياء | Public room discovery
-- Apply once in Supabase SQL Editor after the base schema.
-- Returns only lobby rooms and safe display fields; password hashes and question data stay private.

create or replace function public.ihyaa_list_public_rooms()
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'سجّل الدخول أولًا';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'room_id', rooms.id,
        'code', rooms.code,
        'title', rooms.title,
        'status', rooms.status,
        'host_name', rooms.host_name,
        'player_count', rooms.player_count,
        'has_password', rooms.has_password,
        'created_at', rooms.created_at
      )
      order by rooms.created_at desc
    ),
    '[]'::jsonb
  )
  into result
  from (
    select
      r.id,
      r.code,
      r.title,
      r.status,
      p.username as host_name,
      (select count(*)::integer from public.ihyaa_members m where m.room_id=r.id) as player_count,
      (r.password_hash is not null) as has_password,
      r.created_at
    from public.ihyaa_rooms r
    left join public.ihyaa_profiles p on p.user_id=r.host_id
    where r.status='lobby'
    order by r.created_at desc
    limit 50
  ) as rooms;

  return result;
end;
$$;

revoke all on function public.ihyaa_list_public_rooms() from public, anon;
grant execute on function public.ihyaa_list_public_rooms() to authenticated;
