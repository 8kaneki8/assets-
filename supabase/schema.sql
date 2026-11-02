-- مؤسسة إحياء | Online rooms schema
-- Run this file in Supabase SQL Editor. Never put the service_role key in the browser.
create extension if not exists pgcrypto;

create table if not exists public.ihyaa_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 2 and 24),
  public_id text not null unique default upper(substr(encode(gen_random_bytes(6),'hex'),1,10)),
  created_at timestamptz not null default now()
);
create table if not exists public.ihyaa_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default upper(substr(encode(gen_random_bytes(5),'hex'),1,8)),
  title text not null check (char_length(title) between 2 and 70),
  host_id uuid not null references auth.users(id),
  password_hash text,
  status text not null default 'lobby' check (status in ('lobby','live','archived')),
  settings jsonb not null default '{}'::jsonb,
  current_question_id uuid,
  current_question_text text,
  current_question_points integer,
  current_question_time integer,
  turn_team text check (turn_team in ('red','blue')),
  scores jsonb not null default '{"red":0,"blue":0}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.ihyaa_members (
  room_id uuid not null references public.ihyaa_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team text check (team in ('red','blue')),
  role text not null default 'player' check (role in ('host','player')),
  joined_at timestamptz not null default now(),
  primary key(room_id,user_id)
);
create table if not exists public.ihyaa_questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.ihyaa_rooms(id) on delete cascade,
  category text not null,
  points integer not null check(points between 1 and 10000),
  question_text text not null,
  answer_text text not null,
  seconds integer not null default 30 check(seconds between 5 and 300),
  used boolean not null default false
);
create table if not exists public.ihyaa_submissions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.ihyaa_rooms(id) on delete cascade,
  question_id uuid not null references public.ihyaa_questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answer_text text not null check(char_length(answer_text) between 1 and 500),
  verdict text not null default 'pending' check(verdict in ('pending','correct','wrong')),
  created_at timestamptz not null default now()
);

alter table public.ihyaa_profiles enable row level security;
alter table public.ihyaa_rooms enable row level security;
alter table public.ihyaa_members enable row level security;
alter table public.ihyaa_questions enable row level security;
alter table public.ihyaa_submissions enable row level security;

drop policy if exists "profile own read" on public.ihyaa_profiles;
create policy "profile own read" on public.ihyaa_profiles for select to authenticated using (user_id=auth.uid());
drop policy if exists "profile own insert" on public.ihyaa_profiles;
create policy "profile own insert" on public.ihyaa_profiles for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "profile own update" on public.ihyaa_profiles;
create policy "profile own update" on public.ihyaa_profiles for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

-- All room and roster reads go through SECURITY DEFINER RPCs so answer data
-- and non-member records are never exposed through direct table queries.
drop policy if exists "room members can read room" on public.ihyaa_rooms;
drop policy if exists "members can read roster" on public.ihyaa_members;
-- Questions and submissions are intentionally RPC-only. Players must never SELECT answer_text.
revoke all on public.ihyaa_rooms from anon, authenticated;
revoke all on public.ihyaa_members from anon, authenticated;
revoke all on public.ihyaa_questions from anon, authenticated;
revoke all on public.ihyaa_submissions from anon, authenticated;
revoke insert, update, delete on public.ihyaa_rooms from anon, authenticated;
revoke insert, update, delete on public.ihyaa_members from anon, authenticated;

create or replace function public.ihyaa_register(p_username text)
returns jsonb language plpgsql security definer set search_path=public,auth,extensions as $$
declare p public.ihyaa_profiles;
begin
 if auth.uid() is null then raise exception 'سجّل الدخول أولاً'; end if;
 if char_length(trim(p_username)) not between 2 and 24 then raise exception 'اسم المستخدم من حرفين إلى 24 حرفًا'; end if;
 insert into ihyaa_profiles(user_id,username) values(auth.uid(),trim(p_username))
 on conflict(user_id) do update set username=excluded.username returning * into p;
 return jsonb_build_object('username',p.username,'player_id',p.public_id);
end $$;

create or replace function public.ihyaa_create_room(p_title text,p_password text default null,p_settings jsonb default '{}'::jsonb,p_questions jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,auth,extensions as $$
declare r public.ihyaa_rooms; q jsonb;
begin
 if auth.uid() is null then raise exception 'سجّل الدخول أولاً'; end if;
 if not exists(select 1 from ihyaa_profiles where user_id=auth.uid()) then raise exception 'أنشئ ملف اللاعب أولاً'; end if;
 if char_length(trim(p_title)) not between 2 and 70 then raise exception 'اسم المسابقة غير صالح'; end if;
 insert into ihyaa_rooms(title,host_id,password_hash,settings) values(trim(p_title),auth.uid(),case when coalesce(p_password,'')='' then null else crypt(p_password,gen_salt('bf')) end,coalesce(p_settings,'{}'::jsonb)) returning * into r;
 insert into ihyaa_members(room_id,user_id,role) values(r.id,auth.uid(),'host');
 for q in select * from jsonb_array_elements(coalesce(p_questions,'[]'::jsonb)) loop
  insert into ihyaa_questions(room_id,category,points,question_text,answer_text,seconds)
  values(r.id,coalesce(q->>'category','عام'),greatest(1,least(10000,coalesce((q->>'points')::int,100))),coalesce(q->>'question',''),coalesce(q->>'answer',''),greatest(5,least(300,coalesce((q->>'seconds')::int,30))));
 end loop;
 return jsonb_build_object('room_id',r.id,'code',r.code,'title',r.title,'role','host');
end $$;

create or replace function public.ihyaa_join_room(p_code text,p_password text default null)
returns jsonb language plpgsql security definer set search_path=public,auth,extensions as $$
declare r public.ihyaa_rooms; p public.ihyaa_profiles;
begin
 select * into p from ihyaa_profiles where user_id=auth.uid();
 if p.user_id is null then raise exception 'أنشئ ملف اللاعب أولاً'; end if;
 select * into r from ihyaa_rooms where code=upper(trim(p_code)) and status='lobby';
 if r.id is null then raise exception 'الغرفة غير موجودة أو بدأت أو أُرشفت'; end if;
 if r.password_hash is not null and (p_password is null or crypt(p_password,r.password_hash)<>r.password_hash) then raise exception 'كلمة المرور غير صحيحة'; end if;
 insert into ihyaa_members(room_id,user_id,role) values(r.id,auth.uid(),'player') on conflict do nothing;
 return jsonb_build_object('room_id',r.id,'code',r.code,'title',r.title,'role','player');
end $$;

create or replace function public.ihyaa_room_view(p_room uuid)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare r ihyaa_rooms; myrole text; roster jsonb; q jsonb; prof ihyaa_profiles;
begin
 select role into myrole from ihyaa_members where room_id=p_room and user_id=auth.uid();
 if myrole is null then raise exception 'ليس لديك تصريح لهذه الغرفة'; end if;
 select * into r from ihyaa_rooms where id=p_room;
 select jsonb_agg(jsonb_build_object('username',p.username,'player_id',p.public_id,'user_id',m.user_id,'role',m.role,'team',m.team) order by m.joined_at) into roster from ihyaa_members m join ihyaa_profiles p on p.user_id=m.user_id where m.room_id=p_room;
 q:=null;
 if r.current_question_id is not null then
  if myrole='host' then
   select jsonb_build_object('id',id,'category',category,'points',points,'question',question_text,'answer',answer_text,'seconds',seconds,'used',used) into q from ihyaa_questions where id=r.current_question_id;
  else
   select jsonb_build_object('id',id,'category',category,'points',points,'question',question_text,'seconds',seconds) into q from ihyaa_questions where id=r.current_question_id;
  end if;
 end if;
 return jsonb_build_object('room_id',r.id,'code',r.code,'title',r.title,'status',r.status,'role',myrole,'roster',coalesce(roster,'[]'::jsonb),'question',q,'scores',r.scores,'turn_team',r.turn_team,'settings',r.settings);
end $$;

create or replace function public.ihyaa_host_start(p_room uuid,p_red_name text default 'الفريق الأحمر',p_blue_name text default 'الفريق الأزرق')
returns boolean language plpgsql security definer set search_path=public,auth as $$
begin
 if not exists(select 1 from ihyaa_members where room_id=p_room and user_id=auth.uid() and role='host') then raise exception 'الهوست فقط يمكنه بدء المسابقة'; end if;
 update ihyaa_rooms set status='live',settings=settings||jsonb_build_object('red_name',p_red_name,'blue_name',p_blue_name),turn_team='red',updated_at=now() where id=p_room and status='lobby';
 return found;
end $$;

create or replace function public.ihyaa_host_pick_question(p_room uuid,p_question uuid)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare q ihyaa_questions;
begin
 if not exists(select 1 from ihyaa_members where room_id=p_room and user_id=auth.uid() and role='host') then raise exception 'الهوست فقط يختار السؤال'; end if;
 select * into q from ihyaa_questions where id=p_question and room_id=p_room and used=false;
 if q.id is null then raise exception 'السؤال غير متاح'; end if;
 update ihyaa_rooms set current_question_id=q.id,current_question_text=q.question_text,current_question_points=q.points,current_question_time=q.seconds,updated_at=now() where id=p_room and status='live';
 return jsonb_build_object('id',q.id,'category',q.category,'points',q.points,'question',q.question_text,'answer',q.answer_text,'seconds',q.seconds);
end $$;

create or replace function public.ihyaa_submit_answer(p_room uuid,p_answer text)
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare q uuid; t text; sid uuid;
begin
 if not exists(select 1 from ihyaa_members where room_id=p_room and user_id=auth.uid() and role='player') then raise exception 'هذه الخاصية للاعبين داخل الغرفة فقط'; end if;
 select current_question_id,turn_team into q,t from ihyaa_rooms where id=p_room and status='live';
 if q is null then raise exception 'لا يوجد سؤال مفتوح'; end if;
 if not exists(select 1 from ihyaa_members where room_id=p_room and user_id=auth.uid() and team=t) then raise exception 'ليس دور فريقك الآن'; end if;
 insert into ihyaa_submissions(room_id,question_id,user_id,answer_text) values(p_room,q,auth.uid(),trim(p_answer)) returning id into sid;
 return sid;
end $$;

create or replace function public.ihyaa_host_judge(p_room uuid,p_submission uuid,p_correct boolean)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare s ihyaa_submissions; q ihyaa_questions; tm text; pts int; scr jsonb;
begin
 if not exists(select 1 from ihyaa_members where room_id=p_room and user_id=auth.uid() and role='host') then raise exception 'الهوست فقط يصحح الإجابات'; end if;
 select * into s from ihyaa_submissions where id=p_submission and room_id=p_room and verdict='pending';
 if s.id is null then raise exception 'الإجابة غير متاحة'; end if;
 if not exists(select 1 from ihyaa_rooms where id=p_room and current_question_id=s.question_id and status='live') then raise exception 'تم إغلاق هذا السؤال بالفعل'; end if;
 select * into q from ihyaa_questions where id=s.question_id;
 select team into tm from ihyaa_members where room_id=p_room and user_id=s.user_id;
 if tm is null then raise exception 'لم يحدد الهوست فريق هذا اللاعب'; end if;
 update ihyaa_submissions set verdict=case when p_correct then 'correct' else 'wrong' end where id=s.id;
 update ihyaa_questions set used=true where id=q.id;
 select scores into scr from ihyaa_rooms where id=p_room;
 if p_correct then scr:=jsonb_set(scr,array[tm],to_jsonb(coalesce((scr->>tm)::int,0)+q.points)); end if;
 update ihyaa_rooms set scores=scr,current_question_id=null,current_question_text=null,current_question_points=null,current_question_time=null,turn_team=case when p_correct then tm else case when tm='red' then 'blue' else 'red' end end,updated_at=now() where id=p_room;
 return jsonb_build_object('correct',p_correct,'scores',scr,'turn_team',case when p_correct then tm else case when tm='red' then 'blue' else 'red' end end);
end $$;

create or replace function public.ihyaa_host_archive(p_room uuid)
returns boolean language plpgsql security definer set search_path=public,auth as $$
begin
 if not exists(select 1 from ihyaa_members where room_id=p_room and user_id=auth.uid() and role='host') then raise exception 'الهوست فقط يؤرشف الغرفة'; end if;
 update ihyaa_rooms set status='archived',updated_at=now() where id=p_room;
 return found;
end $$;

grant execute on function public.ihyaa_register(text) to authenticated;
grant execute on function public.ihyaa_create_room(text,text,jsonb,jsonb) to authenticated;
grant execute on function public.ihyaa_join_room(text,text) to authenticated;
grant execute on function public.ihyaa_room_view(uuid) to authenticated;
grant execute on function public.ihyaa_host_start(uuid,text,text) to authenticated;
grant execute on function public.ihyaa_host_pick_question(uuid,uuid) to authenticated;
grant execute on function public.ihyaa_submit_answer(uuid,text) to authenticated;
grant execute on function public.ihyaa_host_judge(uuid,uuid,boolean) to authenticated;
grant execute on function public.ihyaa_host_archive(uuid) to authenticated;

alter publication supabase_realtime add table public.ihyaa_rooms;
alter publication supabase_realtime add table public.ihyaa_members;
alter publication supabase_realtime add table public.ihyaa_submissions;

create or replace function public.ihyaa_host_assign_member(p_room uuid,p_user uuid,p_team text)
returns boolean language plpgsql security definer set search_path=public,auth as $$
begin
 if not exists(select 1 from ihyaa_members where room_id=p_room and user_id=auth.uid() and role='host') then raise exception 'الهوست فقط يوزع الفرق'; end if;
 if p_team not in ('red','blue') then raise exception 'الفريق غير صالح'; end if;
 update ihyaa_members set team=p_team where room_id=p_room and user_id=p_user and role='player';
 return found;
end $$;

create or replace function public.ihyaa_host_list_questions(p_room uuid)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare result jsonb;
begin
 if not exists(select 1 from ihyaa_members where room_id=p_room and user_id=auth.uid() and role='host') then raise exception 'الهوست فقط يعرض الأسئلة'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'category',category,'points',points,'question',question_text,'answer',answer_text,'seconds',seconds,'used',used) order by category,points),'[]'::jsonb) into result from ihyaa_questions where room_id=p_room;
 return result;
end $$;

create or replace function public.ihyaa_host_submissions(p_room uuid)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare result jsonb;
begin
 if not exists(select 1 from ihyaa_members where room_id=p_room and user_id=auth.uid() and role='host') then raise exception 'الهوست فقط يعرض الإجابات'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'username',p.username,'player_id',p.public_id,'answer',s.answer_text,'verdict',s.verdict,'created_at',s.created_at) order by s.created_at desc),'[]'::jsonb) into result
 from ihyaa_submissions s join ihyaa_profiles p on p.user_id=s.user_id where s.room_id=p_room and s.verdict='pending';
 return result;
end $$;

grant execute on function public.ihyaa_host_assign_member(uuid,uuid,text) to authenticated;
grant execute on function public.ihyaa_host_list_questions(uuid) to authenticated;
grant execute on function public.ihyaa_host_submissions(uuid) to authenticated;

create or replace function public.ihyaa_host_invite_player(p_room uuid,p_player_id text)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare p ihyaa_profiles;
begin
 if not exists(select 1 from ihyaa_members where room_id=p_room and user_id=auth.uid() and role='host') then raise exception 'الهوست فقط يضيف اللاعبين'; end if;
 select * into p from ihyaa_profiles where public_id=upper(trim(p_player_id));
 if p.user_id is null then raise exception 'معرّف اللاعب غير موجود؛ اطلب منه تسجيل الدخول أولًا'; end if;
 insert into ihyaa_members(room_id,user_id,role) values(p_room,p.user_id,'player') on conflict do nothing;
 return jsonb_build_object('username',p.username,'player_id',p.public_id,'user_id',p.user_id);
end $$;

create or replace function public.ihyaa_host_list_rooms()
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare result jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('room_id',id,'code',code,'title',title,'status',status,'created_at',created_at) order by created_at desc),'[]'::jsonb)
 into result from ihyaa_rooms where host_id=auth.uid();
 return result;
end $$;
grant execute on function public.ihyaa_host_invite_player(uuid,text) to authenticated;
grant execute on function public.ihyaa_host_list_rooms() to authenticated;

-- Hardening pass: validate team setup and serialize question judging.
create unique index if not exists ihyaa_one_submission_per_player_question
  on public.ihyaa_submissions(room_id,question_id,user_id);

create or replace function public.ihyaa_host_start(p_room uuid,p_red_name text default 'الفريق الأحمر',p_blue_name text default 'الفريق الأزرق')
returns boolean language plpgsql security definer set search_path=public,auth as $$
declare red_count integer; blue_count integer;
begin
 if not exists(select 1 from ihyaa_members where room_id=p_room and user_id=auth.uid() and role='host') then
  raise exception 'الهوست فقط يمكنه بدء المسابقة';
 end if;
 select count(*) filter(where team='red'),count(*) filter(where team='blue')
 into red_count,blue_count from ihyaa_members where room_id=p_room and role='player';
 if red_count=0 or blue_count=0 then raise exception 'وزّع اللاعبين على الفريقين قبل بدء المسابقة'; end if;
 update ihyaa_rooms set status='live',settings=settings||jsonb_build_object('red_name',coalesce(nullif(trim(p_red_name),''),'الفريق الأحمر'),'blue_name',coalesce(nullif(trim(p_blue_name),''),'الفريق الأزرق')),turn_team='red',updated_at=now()
 where id=p_room and status='lobby';
 if not found then raise exception 'الغرفة بدأت بالفعل أو لم تعد متاحة'; end if;
 return true;
end $$;

create or replace function public.ihyaa_host_pick_question(p_room uuid,p_question uuid)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare q ihyaa_questions; r ihyaa_rooms;
begin
 if not exists(select 1 from ihyaa_members where room_id=p_room and user_id=auth.uid() and role='host') then raise exception 'الهوست فقط يختار السؤال'; end if;
 select * into r from ihyaa_rooms where id=p_room for update;
 if r.status<>'live' then raise exception 'ابدأ المسابقة أولًا'; end if;
 if r.current_question_id is not null then raise exception 'أغلق السؤال الحالي قبل فتح سؤال جديد'; end if;
 select * into q from ihyaa_questions where id=p_question and room_id=p_room and used=false;
 if q.id is null then raise exception 'السؤال غير متاح'; end if;
 update ihyaa_rooms set current_question_id=q.id,current_question_text=q.question_text,current_question_points=q.points,current_question_time=q.seconds,updated_at=now() where id=p_room;
 return jsonb_build_object('id',q.id,'category',q.category,'points',q.points,'question',q.question_text,'answer',q.answer_text,'seconds',q.seconds);
end $$;

create or replace function public.ihyaa_host_judge(p_room uuid,p_submission uuid,p_correct boolean)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare s ihyaa_submissions; q ihyaa_questions; tm text; pts int; scr jsonb; r ihyaa_rooms;
begin
 if not exists(select 1 from ihyaa_members where room_id=p_room and user_id=auth.uid() and role='host') then raise exception 'الهوست فقط يصحح الإجابات'; end if;
 select * into r from ihyaa_rooms where id=p_room for update;
 if r.id is null or r.status<>'live' then raise exception 'المسابقة ليست جارية'; end if;
 select * into s from ihyaa_submissions where id=p_submission and room_id=p_room and verdict='pending' for update;
 if s.id is null then raise exception 'الإجابة غير متاحة أو تم تصحيحها'; end if;
 if r.current_question_id is null or r.current_question_id<>s.question_id then raise exception 'تم إغلاق هذا السؤال بالفعل'; end if;
 select * into q from ihyaa_questions where id=s.question_id;
 select team into tm from ihyaa_members where room_id=p_room and user_id=s.user_id and role='player';
 if tm is null then raise exception 'لم يحدد الهوست فريق هذا اللاعب'; end if;
 update ihyaa_submissions set verdict=case when id=s.id and p_correct then 'correct' when id=s.id then 'wrong' else 'wrong' end
 where room_id=p_room and question_id=s.question_id and verdict='pending';
 update ihyaa_questions set used=true where id=q.id;
 scr:=r.scores;
 if p_correct then scr:=jsonb_set(scr,array[tm],to_jsonb(coalesce((scr->>tm)::int,0)+q.points)); end if;
 update ihyaa_rooms set scores=scr,current_question_id=null,current_question_text=null,current_question_points=null,current_question_time=null,
 turn_team=case when p_correct then tm else case when tm='red' then 'blue' else 'red' end end,updated_at=now()
 where id=p_room;
 return jsonb_build_object('correct',p_correct,'scores',scr,'turn_team',case when p_correct then tm else case when tm='red' then 'blue' else 'red' end end);
end $$;
