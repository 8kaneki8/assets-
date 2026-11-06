-- Ihyaa online rooms: server-authoritative question clock and atomic resolution.
-- Apply once in Supabase SQL Editor after the existing schema.
begin;
alter table public.ihyaa_rooms add column if not exists question_deadline_at timestamptz;

create or replace function public.ihyaa_host_start(p_room uuid,p_red_name text default 'الفريق الأحمر',p_blue_name text default 'الفريق الأزرق')
returns boolean language plpgsql security definer set search_path=public,auth as $$
declare r public.ihyaa_rooms; red_count integer; blue_count integer; unassigned_count integer; question_count integer;
begin
 if auth.uid() is null then raise exception 'سجّل الدخول أولًا'; end if;
 select * into r from public.ihyaa_rooms where id=p_room for update;
 if r.id is null or r.status<>'lobby' then raise exception 'الغرفة بدأت بالفعل أو لم تعد متاحة'; end if;
 if not exists(select 1 from public.ihyaa_members where room_id=p_room and user_id=auth.uid() and role='host') then raise exception 'الهوست فقط يمكنه بدء المسابقة'; end if;
 select count(*) filter(where team='red'),count(*) filter(where team='blue'),count(*) filter(where team is null)
 into red_count,blue_count,unassigned_count from public.ihyaa_members where room_id=p_room and role='player';
 if red_count=0 or blue_count=0 then raise exception 'يجب وجود لاعب واحد على الأقل في كل فريق'; end if;
 if unassigned_count>0 then raise exception 'وزّع جميع اللاعبين على الفرق قبل البدء'; end if;
 select count(*) into question_count from public.ihyaa_questions where room_id=p_room;
 if question_count=0 then raise exception 'أضف أسئلة للمسابقة قبل البدء'; end if;
 update public.ihyaa_rooms set status='live',
 settings=settings||jsonb_build_object('red_name',coalesce(nullif(trim(p_red_name),''),'الفريق الأحمر'),'blue_name',coalesce(nullif(trim(p_blue_name),''),'الفريق الأزرق')),
 turn_team=case when random()<0.5 then 'red' else 'blue' end,question_deadline_at=null,updated_at=now() where id=p_room;
 return true;
end $$;

create or replace function public.ihyaa_host_pick_question(p_room uuid,p_question uuid)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare q public.ihyaa_questions; r public.ihyaa_rooms;
begin
 if auth.uid() is null or not exists(select 1 from public.ihyaa_members where room_id=p_room and user_id=auth.uid() and role='host') then raise exception 'الهوست فقط يختار السؤال'; end if;
 select * into r from public.ihyaa_rooms where id=p_room for update;
 if r.id is null or r.status<>'live' then raise exception 'ابدأ المسابقة أولًا'; end if;
 if r.current_question_id is not null then raise exception 'أغلق السؤال الحالي قبل فتح سؤال جديد'; end if;
 select * into q from public.ihyaa_questions where id=p_question and room_id=p_room and used=false;
 if q.id is null then raise exception 'السؤال غير متاح'; end if;
 update public.ihyaa_rooms set current_question_id=q.id,current_question_text=q.question_text,current_question_points=q.points,
 current_question_time=q.seconds,question_deadline_at=now()+make_interval(secs=>q.seconds),updated_at=now() where id=p_room;
 return jsonb_build_object('id',q.id,'category',q.category,'points',q.points,'question',q.question_text,'answer',q.answer_text,'seconds',q.seconds);
end $$;

create or replace function public.ihyaa_room_view(p_room uuid)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare r public.ihyaa_rooms; myrole text; roster jsonb; q jsonb; remaining integer;
begin
 select role into myrole from public.ihyaa_members where room_id=p_room and user_id=auth.uid();
 if myrole is null then raise exception 'ليس لديك تصريح لهذه الغرفة'; end if;
 select * into r from public.ihyaa_rooms where id=p_room;
 select coalesce(jsonb_agg(jsonb_build_object('username',p.username,'player_id',p.public_id,'user_id',m.user_id,'role',m.role,'team',m.team) order by m.joined_at),'[]'::jsonb)
 into roster from public.ihyaa_members m join public.ihyaa_profiles p on p.user_id=m.user_id where m.room_id=p_room;
 q:=null;
 if r.current_question_id is not null then
  if myrole='host' then
   select jsonb_build_object('id',id,'category',category,'points',points,'question',question_text,'answer',answer_text,'seconds',seconds,'used',used)
   into q from public.ihyaa_questions where id=r.current_question_id;
  else
   select jsonb_build_object('id',id,'category',category,'points',points,'question',question_text,'seconds',seconds)
   into q from public.ihyaa_questions where id=r.current_question_id;
  end if;
 end if;
 remaining:=case when r.question_deadline_at is null then null else greatest(0,ceil(extract(epoch from (r.question_deadline_at-now())))::integer) end;
 return jsonb_build_object('room_id',r.id,'code',r.code,'title',r.title,'status',r.status,'role',myrole,'roster',roster,'question',q,
 'scores',r.scores,'turn_team',r.turn_team,'settings',r.settings,'question_deadline_at',r.question_deadline_at,'remaining_seconds',remaining);
end $$;

create or replace function public.ihyaa_submit_answer(p_room uuid,p_answer text)
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare r public.ihyaa_rooms; sid uuid; tm text;
begin
 if auth.uid() is null or not exists(select 1 from public.ihyaa_members where room_id=p_room and user_id=auth.uid() and role='player') then raise exception 'هذه الخاصية للاعبين داخل الغرفة فقط'; end if;
 if char_length(trim(coalesce(p_answer,''))) not between 1 and 500 then raise exception 'الإجابة مطلوبة وبحد أقصى 500 حرف'; end if;
 select * into r from public.ihyaa_rooms where id=p_room for update;
 if r.id is null or r.status<>'live' or r.current_question_id is null then raise exception 'لا يوجد سؤال مفتوح'; end if;
 if r.question_deadline_at is null or now()>=r.question_deadline_at then raise exception 'انتهى وقت الإجابة'; end if;
 select team into tm from public.ihyaa_members where room_id=p_room and user_id=auth.uid() and role='player';
 if tm is null or tm<>r.turn_team then raise exception 'ليس دور فريقك الآن أو لم يحدد الهوست فريقك'; end if;
 insert into public.ihyaa_submissions(room_id,question_id,user_id,answer_text) values(p_room,r.current_question_id,auth.uid(),trim(p_answer)) returning id into sid;
 return sid;
exception when unique_violation then raise exception 'لقد أرسلت إجابتك بالفعل لهذا السؤال';
end $$;

create or replace function public.ihyaa_host_judge(p_room uuid,p_submission uuid,p_correct boolean)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare r public.ihyaa_rooms; s public.ihyaa_submissions; q public.ihyaa_questions; tm text; scr jsonb; next_team text;
begin
 if auth.uid() is null or not exists(select 1 from public.ihyaa_members where room_id=p_room and user_id=auth.uid() and role='host') then raise exception 'الهوست فقط يصحح الإجابات'; end if;
 select * into r from public.ihyaa_rooms where id=p_room for update;
 if r.id is null or r.status<>'live' then raise exception 'المسابقة ليست جارية'; end if;
 select * into s from public.ihyaa_submissions where id=p_submission and room_id=p_room and verdict='pending' for update;
 if s.id is null then raise exception 'الإجابة غير متاحة أو تم تصحيحها'; end if;
 if r.current_question_id is null or r.current_question_id<>s.question_id then raise exception 'تم إغلاق هذا السؤال بالفعل'; end if;
 select * into q from public.ihyaa_questions where id=s.question_id;
 select team into tm from public.ihyaa_members where room_id=p_room and user_id=s.user_id and role='player';
 if tm is null then raise exception 'لم يحدد الهوست فريق هذا اللاعب'; end if;
 update public.ihyaa_submissions set verdict=case when id=s.id and p_correct then 'correct' else 'wrong' end where room_id=p_room and question_id=s.question_id and verdict='pending';
 update public.ihyaa_questions set used=true where id=q.id;
 scr:=r.scores;
 if p_correct then scr:=jsonb_set(scr,array[tm],to_jsonb(coalesce((scr->>tm)::integer,0)+q.points)); end if;
 next_team:=case when p_correct then tm else case when tm='red' then 'blue' else 'red' end end;
 update public.ihyaa_rooms set scores=scr,current_question_id=null,current_question_text=null,current_question_points=null,current_question_time=null,
 question_deadline_at=null,turn_team=next_team,updated_at=now() where id=p_room;
 return jsonb_build_object('correct',p_correct,'scores',scr,'turn_team',next_team);
end $$;

create or replace function public.ihyaa_host_timeout(p_room uuid)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare r public.ihyaa_rooms; next_team text;
begin
 if auth.uid() is null or not exists(select 1 from public.ihyaa_members where room_id=p_room and user_id=auth.uid() and role='host') then raise exception 'الهوست فقط ينهي السؤال'; end if;
 select * into r from public.ihyaa_rooms where id=p_room for update;
 if r.id is null or r.status<>'live' or r.current_question_id is null then raise exception 'لا يوجد سؤال مفتوح'; end if;
 if r.question_deadline_at is null or now()<r.question_deadline_at then raise exception 'لم ينته وقت السؤال بعد'; end if;
 update public.ihyaa_submissions set verdict='wrong' where room_id=p_room and question_id=r.current_question_id and verdict='pending';
 update public.ihyaa_questions set used=true where id=r.current_question_id;
 next_team:=case when r.turn_team='red' then 'blue' else 'red' end;
 update public.ihyaa_rooms set current_question_id=null,current_question_text=null,current_question_points=null,current_question_time=null,
 question_deadline_at=null,turn_team=next_team,updated_at=now() where id=p_room;
 return jsonb_build_object('expired',true,'scores',r.scores,'turn_team',next_team);
end $$;

grant execute on function public.ihyaa_host_start(uuid,text,text) to authenticated;
grant execute on function public.ihyaa_host_pick_question(uuid,uuid) to authenticated;
grant execute on function public.ihyaa_room_view(uuid) to authenticated;
grant execute on function public.ihyaa_submit_answer(uuid,text) to authenticated;
grant execute on function public.ihyaa_host_judge(uuid,uuid,boolean) to authenticated;
grant execute on function public.ihyaa_host_timeout(uuid) to authenticated;
commit;
