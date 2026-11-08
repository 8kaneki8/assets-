-- مؤسسة إحياء | Player category-and-points board
-- Run this file in Supabase SQL Editor after supabase/schema.sql.
-- Players see category + points only. Question text and answers remain private until selected.

create or replace function public.ihyaa_player_list_board(p_room uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists(
    select 1 from public.ihyaa_members
    where room_id=p_room and user_id=auth.uid() and role='player'
  ) then
    raise exception 'هذه اللوحة للاعبين داخل الغرفة فقط';
  end if;

  if not exists(select 1 from public.ihyaa_rooms where id=p_room and status='live') then
    raise exception 'المسابقة لم تبدأ بعد';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',q.id,
      'category',q.category,
      'points',q.points,
      'used',q.used
    ) order by q.category, q.points
  ),'[]'::jsonb)
  into result
  from public.ihyaa_questions q
  where q.room_id=p_room;

  return result;
end;
$$;

create or replace function public.ihyaa_player_pick_question(p_room uuid,p_question uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  r public.ihyaa_rooms;
  q public.ihyaa_questions;
  tm text;
begin
  if auth.uid() is null then raise exception 'سجّل الدخول أولًا'; end if;

  select * into r
  from public.ihyaa_rooms
  where id=p_room
  for update;

  if r.id is null or r.status<>'live' then
    raise exception 'المسابقة ليست جارية';
  end if;

  if r.current_question_id is not null then
    raise exception 'يوجد سؤال مفتوح بالفعل؛ انتظر الهوست حتى ينهيه';
  end if;

  select team into tm
  from public.ihyaa_members
  where room_id=p_room and user_id=auth.uid() and role='player';

  if tm is null then
    raise exception 'هذه الخاصية للاعبين داخل الغرفة فقط';
  end if;

  if tm<>r.turn_team then
    raise exception 'انتظر دور فريقك لاختيار السؤال';
  end if;

  select * into q
  from public.ihyaa_questions
  where id=p_question and room_id=p_room and used=false
  for update;

  if q.id is null then raise exception 'هذا السؤال غير متاح أو تم اختياره بالفعل'; end if;

  update public.ihyaa_rooms
  set current_question_id=q.id,
      current_question_text=q.question_text,
      current_question_points=q.points,
      current_question_time=q.seconds,
      updated_at=now()
  where id=p_room;

  return jsonb_build_object(
    'id',q.id,
    'category',q.category,
    'points',q.points,
    'question',q.question_text,
    'seconds',q.seconds
  );
end;
$$;

revoke all on function public.ihyaa_player_list_board(uuid) from public,anon;
revoke all on function public.ihyaa_player_pick_question(uuid,uuid) from public,anon;
grant execute on function public.ihyaa_player_list_board(uuid) to authenticated;
grant execute on function public.ihyaa_player_pick_question(uuid,uuid) to authenticated;

notify pgrst, 'reload schema';
