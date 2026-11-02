-- مؤسسة إحياء: حماية تجهيز الفرق قبل بدء المسابقة
-- Run once after the original schema.sql has succeeded.

create or replace function public.ihyaa_host_assign_member(p_room uuid,p_user uuid,p_team text)
returns boolean
language plpgsql
security definer
set search_path=public,auth
as $$
declare r public.ihyaa_rooms;
begin
  if auth.uid() is null then raise exception 'سجّل الدخول أولًا'; end if;
  select * into r from public.ihyaa_rooms where id=p_room for update;
  if r.id is null or r.status <> 'lobby' then
    raise exception 'توزيع الفرق متاح قبل بدء المسابقة فقط';
  end if;
  if not exists (
    select 1 from public.ihyaa_members
    where room_id=p_room and user_id=auth.uid() and role='host'
  ) then raise exception 'الهوست فقط يوزع الفرق'; end if;
  if p_team not in ('red','blue') then raise exception 'الفريق غير صالح'; end if;
  update public.ihyaa_members
  set team=p_team
  where room_id=p_room and user_id=p_user and role='player';
  if not found then raise exception 'اللاعب غير موجود في هذه الغرفة'; end if;
  return true;
end;
$$;

create or replace function public.ihyaa_host_invite_player(p_room uuid,p_player_id text)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare p public.ihyaa_profiles; r public.ihyaa_rooms;
begin
  if auth.uid() is null then raise exception 'سجّل الدخول أولًا'; end if;
  select * into r from public.ihyaa_rooms where id=p_room for update;
  if r.id is null or r.status <> 'lobby' then
    raise exception 'إضافة اللاعبين متاحة قبل بدء المسابقة فقط';
  end if;
  if not exists (
    select 1 from public.ihyaa_members
    where room_id=p_room and user_id=auth.uid() and role='host'
  ) then raise exception 'الهوست فقط يضيف اللاعبين'; end if;
  select * into p from public.ihyaa_profiles
  where public_id=upper(trim(coalesce(p_player_id,'')));
  if p.user_id is null then
    raise exception 'معرّف اللاعب غير موجود؛ اطلب منه تسجيل الدخول أولًا';
  end if;
  insert into public.ihyaa_members(room_id,user_id,role)
  values(p_room,p.user_id,'player') on conflict(room_id,user_id) do nothing;
  return jsonb_build_object(
    'username',p.username,'player_id',p.public_id,'user_id',p.user_id
  );
end;
$$;

create or replace function public.ihyaa_host_start(
  p_room uuid,
  p_red_name text default 'الفريق الأحمر',
  p_blue_name text default 'الفريق الأزرق'
)
returns boolean
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  r public.ihyaa_rooms;
  red_count integer;
  blue_count integer;
  unassigned_count integer;
  question_count integer;
begin
  if auth.uid() is null then raise exception 'سجّل الدخول أولًا'; end if;
  select * into r from public.ihyaa_rooms where id=p_room for update;
  if r.id is null or r.status <> 'lobby' then
    raise exception 'الغرفة بدأت بالفعل أو لم تعد متاحة';
  end if;
  if not exists (
    select 1 from public.ihyaa_members
    where room_id=p_room and user_id=auth.uid() and role='host'
  ) then raise exception 'الهوست فقط يمكنه بدء المسابقة'; end if;

  select
    count(*) filter (where team='red'),
    count(*) filter (where team='blue'),
    count(*) filter (where team is null)
  into red_count,blue_count,unassigned_count
  from public.ihyaa_members
  where room_id=p_room and role='player';

  if red_count=0 or blue_count=0 then
    raise exception 'يجب وجود لاعب واحد على الأقل في كل فريق';
  end if;
  if unassigned_count>0 then
    raise exception 'وزّع جميع اللاعبين على الفرق قبل البدء';
  end if;
  select count(*) into question_count
  from public.ihyaa_questions where room_id=p_room;
  if question_count=0 then raise exception 'أضف أسئلة للمسابقة قبل البدء'; end if;

  update public.ihyaa_rooms
  set status='live',
      settings=settings||jsonb_build_object(
        'red_name',coalesce(nullif(trim(p_red_name),''),'الفريق الأحمر'),
        'blue_name',coalesce(nullif(trim(p_blue_name),''),'الفريق الأزرق')
      ),
      turn_team='red',
      updated_at=now()
  where id=p_room;
  return true;
end;
$$;

grant execute on function public.ihyaa_host_assign_member(uuid,uuid,text) to authenticated;
grant execute on function public.ihyaa_host_invite_player(uuid,text) to authenticated;
grant execute on function public.ihyaa_host_start(uuid,text,text) to authenticated;
