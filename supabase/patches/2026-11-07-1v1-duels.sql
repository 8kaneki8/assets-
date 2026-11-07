-- Ihyaa 1v1 duels: isolated, server-authoritative match subsystem.
-- Apply after the existing supabase/schema.sql and patches.
create extension if not exists pgcrypto;

create table if not exists public.ihyaa_duel_bank (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 category text not null,
 question_text text not null,
 options jsonb not null,
 correct_option smallint not null check(correct_option between 0 and 3),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(jsonb_typeof(options)='array' and jsonb_array_length(options)=4)
);
create table if not exists public.ihyaa_duels (
 id uuid primary key default gen_random_uuid(),
 code text not null unique default upper(substr(encode(gen_random_bytes(5),'hex'),1,8)),
 host_id uuid not null references auth.users(id),
 red_user uuid not null references auth.users(id),
 blue_user uuid not null references auth.users(id),
 status text not null default 'lobby' check(status in ('lobby','live','paused','golden','completed','cancelled')),
 current_no smallint not null default 1 check(current_no between 1 and 16),
 red_score integer not null default 0 check(red_score>=0),
 blue_score integer not null default 0 check(blue_score>=0),
 red_correct smallint not null default 0,
 blue_correct smallint not null default 0,
 red_wrong smallint not null default 0,
 blue_wrong smallint not null default 0,
 started_at timestamptz,
 finished_at timestamptz,
 winner_id uuid references auth.users(id),
 settings jsonb not null default '{"correct_points":100,"last_question_points":200,"winner_reward":600}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(red_user<>blue_user)
);
create table if not exists public.ihyaa_duel_questions (
 duel_id uuid not null references public.ihyaa_duels(id) on delete cascade,
 question_no smallint not null check(question_no between 1 and 16),
 category text not null,
 question_text text not null,
 options jsonb not null,
 correct_option smallint not null check(correct_option between 0 and 3),
 is_golden boolean not null default false,
 primary key(duel_id,question_no),
 check(jsonb_typeof(options)='array' and jsonb_array_length(options)=4)
);
create table if not exists public.ihyaa_duel_answers (
 id uuid primary key default gen_random_uuid(),
 duel_id uuid not null,
 question_no smallint not null,
 user_id uuid not null references auth.users(id),
 answer_option smallint not null check(answer_option between 0 and 3),
 is_correct boolean not null,
 points_awarded integer not null default 0,
 elapsed_ms integer,
 received_at timestamptz not null default clock_timestamp(),
 unique(duel_id,question_no,user_id),
 foreign key(duel_id,question_no) references public.ihyaa_duel_questions(duel_id,question_no) on delete cascade
);
create table if not exists public.ihyaa_duel_events (
 id bigint generated always as identity primary key,
 duel_id uuid not null references public.ihyaa_duels(id) on delete cascade,
 actor_id uuid references auth.users(id),
 event_type text not null,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

alter table public.ihyaa_duel_bank enable row level security;
alter table public.ihyaa_duels enable row level security;
alter table public.ihyaa_duel_questions enable row level security;
alter table public.ihyaa_duel_answers enable row level security;
alter table public.ihyaa_duel_events enable row level security;
drop policy if exists ihyaa_duel_bank_owner on public.ihyaa_duel_bank;
drop policy if exists ihyaa_duels_participants_read on public.ihyaa_duels;
create policy ihyaa_duels_participants_read on public.ihyaa_duels for select to authenticated using(auth.uid() in(host_id,red_user,blue_user));
revoke all on public.ihyaa_duel_bank,public.ihyaa_duels,public.ihyaa_duel_questions,public.ihyaa_duel_answers,public.ihyaa_duel_events from anon,authenticated;
grant select on public.ihyaa_duels to authenticated;
-- Question snapshots, correct answers, individual submissions and admin events are RPC-only.

create or replace function public.ihyaa_duel_bank_save(p_id uuid,p_category text,p_question text,p_options jsonb,p_correct smallint)
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare out_id uuid;
begin
 if auth.uid() is null or not exists(select 1 from ihyaa_profiles where user_id=auth.uid()) then raise exception 'سجّل الدخول أولاً'; end if;
 if char_length(trim(p_category)) not between 2 and 50 or char_length(trim(p_question)) not between 5 and 1000 or jsonb_typeof(p_options)<>'array' or jsonb_array_length(p_options)<>4 or p_correct not between 0 and 3 then raise exception 'بيانات السؤال أو الاختيارات غير مكتملة'; end if;
 if exists(select 1 from jsonb_array_elements_text(p_options) as opts(value) where char_length(trim(value))=0) then raise exception 'يجب كتابة الاختيارات الأربعة'; end if;
 if p_id is null then
  insert into ihyaa_duel_bank(owner_id,category,question_text,options,correct_option) values(auth.uid(),trim(p_category),trim(p_question),p_options,p_correct) returning id into out_id;
 else
  update ihyaa_duel_bank set category=trim(p_category),question_text=trim(p_question),options=p_options,correct_option=p_correct,updated_at=now() where id=p_id and owner_id=auth.uid() returning id into out_id;
  if out_id is null then raise exception 'السؤال غير موجود أو لا تملك صلاحية تعديله'; end if;
 end if;
 return out_id;
end $$;

create or replace function public.ihyaa_duel_bank_delete(p_id uuid)
returns boolean language plpgsql security definer set search_path=public,auth as $$
begin
 delete from ihyaa_duel_bank where id=p_id and owner_id=auth.uid();
 if not found then raise exception 'السؤال غير موجود أو لا تملك صلاحية حذفه'; end if;
 return true;
end $$;

create or replace function public.ihyaa_duel_bank_list()
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v jsonb;
begin
 if auth.uid() is null then raise exception 'سجّل الدخول أولاً'; end if;
 if exists(select 1 from ihyaa_duels where auth.uid() in(red_user,blue_user) and status in('lobby','live','paused','golden')) then raise exception 'لا يمكن فتح بنك الإجابات أثناء مشاركتك في مواجهة'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'category',category,'question',question_text,'options',options,'correct_option',correct_option,'active',active) order by updated_at desc),'[]'::jsonb)
 into v from ihyaa_duel_bank where owner_id=auth.uid();
 return v;
end $$;

create or replace function public.ihyaa_duel_create(p_red_id text,p_blue_id text,p_question_ids uuid[],p_settings jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare red uuid; blue uuid; d ihyaa_duels; n integer;
begin
 if auth.uid() is null then raise exception 'سجّل الدخول أولاً'; end if;
 select user_id into red from ihyaa_profiles where public_id=upper(trim(p_red_id));
 select user_id into blue from ihyaa_profiles where public_id=upper(trim(p_blue_id));
 if red is null or blue is null or red=blue then raise exception 'تحقق من معرفَي اللاعبين؛ يجب أن يكونا لاعبين مختلفين'; end if;
 if auth.uid() in(red,blue) then raise exception 'يجب أن يكون الهوست منفصلًا عن لاعبي المواجهة'; end if;
 if coalesce(array_length(p_question_ids,1),0)<>16 then raise exception 'اختر 15 سؤالًا وسؤالًا ذهبيًا واحدًا'; end if;
 if (select count(distinct x) from unnest(p_question_ids) x)<>16 then raise exception 'لا يمكن تكرار السؤال داخل المواجهة'; end if;
 if exists(select 1 from unnest(p_question_ids) x left join ihyaa_duel_bank b on b.id=x and b.owner_id=auth.uid() and b.active where b.id is null) then raise exception 'يوجد سؤال غير صالح أو لا تملكه'; end if;
 insert into ihyaa_duels(host_id,red_user,blue_user,settings) values(auth.uid(),red,blue,jsonb_build_object('correct_points',greatest(0,least(10000,coalesce((p_settings->>'correct_points')::int,100))),'last_question_points',greatest(0,least(10000,coalesce((p_settings->>'last_question_points')::int,200))),'winner_reward',600)) returning * into d;
 insert into ihyaa_duel_questions(duel_id,question_no,category,question_text,options,correct_option,is_golden)
 select d.id,x.ordinality::smallint,b.category,b.question_text,b.options,b.correct_option,x.ordinality=16
 from unnest(p_question_ids) with ordinality x(id,ordinality) join ihyaa_duel_bank b on b.id=x.id;
 insert into ihyaa_duel_events(duel_id,actor_id,event_type,details) values(d.id,auth.uid(),'created',jsonb_build_object('red_id',p_red_id,'blue_id',p_blue_id,'question_count',16));
 return jsonb_build_object('duel_id',d.id,'code',d.code,'status',d.status);
end $$;

create or replace function public.ihyaa_duel_start(p_duel uuid)
returns boolean language plpgsql security definer set search_path=public,auth as $$
begin
 update ihyaa_duels set status='live',started_at=coalesce(started_at,now()),updated_at=now() where id=p_duel and host_id=auth.uid() and status='lobby';
 if not found then raise exception 'لا يمكن بدء المواجهة؛ تحقق من صلاحية الهوست وحالة المواجهة'; end if;
 insert into ihyaa_duel_events(duel_id,actor_id,event_type) values(p_duel,auth.uid(),'started');
 return true;
end $$;

create or replace function public.ihyaa_duel_answer(p_duel uuid,p_option smallint,p_elapsed_ms integer default null)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare d ihyaa_duels; q ihyaa_duel_questions; good boolean; pts integer; uid uuid;
begin
 uid:=auth.uid();
 select * into d from ihyaa_duels where id=p_duel for update;
 if d.id is null or uid not in(d.red_user,d.blue_user) then raise exception 'لا تملك صلاحية المشاركة في هذه المواجهة'; end if;
 if d.status not in('live','golden') then raise exception 'المواجهة متوقفة أو منتهية'; end if;
 select * into q from ihyaa_duel_questions where duel_id=p_duel and question_no=d.current_no;
 if q.question_no is null then raise exception 'السؤال الحالي غير متاح'; end if;
 if exists(select 1 from ihyaa_duel_answers where duel_id=p_duel and question_no=d.current_no and user_id=uid) then raise exception 'تم تسجيل إجابتك لهذا السؤال بالفعل'; end if;
 good:=p_option=q.correct_option;
 pts:=case when good and d.status='live' and d.current_no=15 then (d.settings->>'last_question_points')::int when good and d.status='live' then (d.settings->>'correct_points')::int else 0 end;
 insert into ihyaa_duel_answers(duel_id,question_no,user_id,answer_option,is_correct,points_awarded,elapsed_ms) values(p_duel,d.current_no,uid,p_option,good,pts,greatest(0,least(3600000,coalesce(p_elapsed_ms,0))));
 if uid=d.red_user then update ihyaa_duels set red_score=red_score+pts,red_correct=red_correct+good::int,red_wrong=red_wrong+(not good)::int,updated_at=now() where id=p_duel;
 else update ihyaa_duels set blue_score=blue_score+pts,blue_correct=blue_correct+good::int,blue_wrong=blue_wrong+(not good)::int,updated_at=now() where id=p_duel; end if;
 return jsonb_build_object('accepted',true,'correct',good,'points',pts,'question_no',d.current_no);
end $$;

create or replace function public.ihyaa_duel_advance(p_duel uuid)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare d ihyaa_duels; cnt integer; winner uuid; a ihyaa_duel_answers; b ihyaa_duel_answers;
begin
 select * into d from ihyaa_duels where id=p_duel and host_id=auth.uid() for update;
 if d.id is null then raise exception 'الهوست فقط يستطيع تحريك المواجهة'; end if;
 if d.status not in('live','golden') then raise exception 'المواجهة ليست في حالة تسمح بالانتقال'; end if;
 select count(*) into cnt from ihyaa_duel_answers where duel_id=p_duel and question_no=d.current_no;
 if cnt<2 then raise exception 'انتظر إجابة اللاعبين أو استخدم تجاوز السؤال من أدوات الهوست'; end if;
 if d.status='golden' then
  select * into a from ihyaa_duel_answers where duel_id=p_duel and question_no=16 and user_id=d.red_user;
  select * into b from ihyaa_duel_answers where duel_id=p_duel and question_no=16 and user_id=d.blue_user;
  if a.is_correct and b.is_correct then winner:=case when a.received_at<=b.received_at then d.red_user else d.blue_user end;
  elsif a.is_correct then winner:=d.red_user; elsif b.is_correct then winner:=d.blue_user; else
   insert into ihyaa_duel_events(duel_id,actor_id,event_type,details) values(p_duel,auth.uid(),'golden_draw',jsonb_build_object('note','Both golden answers were incorrect'));
   raise exception 'أجاب اللاعبان إجابة خاطئة؛ يلزم تجهيز سؤال ذهبي جديد';
  end if;
  update ihyaa_duels set status='completed',winner_id=winner,finished_at=now(),updated_at=now() where id=p_duel;
  insert into ihyaa_duel_events(duel_id,actor_id,event_type,details) values(p_duel,auth.uid(),'completed',jsonb_build_object('winner_id',winner,'golden',true));
  return jsonb_build_object('status','completed','winner_id',winner);
 end if;
 if d.current_no<15 then
  update ihyaa_duels set current_no=current_no+1,updated_at=now() where id=p_duel;
  return jsonb_build_object('status','live','question_no',d.current_no+1);
 end if;
 if d.red_score>d.blue_score then winner:=d.red_user; elsif d.blue_score>d.red_score then winner:=d.blue_user; end if;
 if winner is not null then
  update ihyaa_duels set status='completed',winner_id=winner,finished_at=now(),updated_at=now() where id=p_duel;
  insert into ihyaa_duel_events(duel_id,actor_id,event_type,details) values(p_duel,auth.uid(),'completed',jsonb_build_object('winner_id',winner,'golden',false));
  return jsonb_build_object('status','completed','winner_id',winner);
 end if;
 update ihyaa_duels set status='golden',current_no=16,updated_at=now() where id=p_duel;
 return jsonb_build_object('status','golden','question_no',16);
end $$;

create or replace function public.ihyaa_duel_control(p_duel uuid,p_action text,p_details jsonb default '{}'::jsonb)
returns boolean language plpgsql security definer set search_path=public,auth as $$
declare d ihyaa_duels;
begin
 select * into d from ihyaa_duels where id=p_duel and host_id=auth.uid() for update;
 if d.id is null then raise exception 'الهوست فقط يستطيع التحكم بالمواجهة'; end if;
 if p_action='pause' and d.status in('live','golden') then update ihyaa_duels set status='paused',updated_at=now() where id=p_duel;
 elsif p_action='resume' and d.status='paused' then update ihyaa_duels set status=case when current_no=16 then 'golden' else 'live' end,updated_at=now() where id=p_duel;
 elsif p_action='cancel' and d.status not in('completed','cancelled') then update ihyaa_duels set status='cancelled',finished_at=now(),updated_at=now() where id=p_duel;
 elsif p_action='finish' and d.status in('live','paused','golden') then update ihyaa_duels set status='completed',winner_id=case when red_score=blue_score then null when red_score>blue_score then red_user else blue_user end,finished_at=now(),updated_at=now() where id=p_duel;
 else raise exception 'العملية غير متاحة في الحالة الحالية'; end if;
 insert into ihyaa_duel_events(duel_id,actor_id,event_type,details) values(p_duel,auth.uid(),'host_'||p_action,coalesce(p_details,'{}'::jsonb));
 return true;
end $$;

create or replace function public.ihyaa_duel_view(p_duel uuid)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare d ihyaa_duels; q ihyaa_duel_questions; uid uuid; is_host boolean; me uuid; answers jsonb; my_answer jsonb; red_name text; blue_name text;
begin
 uid:=auth.uid(); select * into d from ihyaa_duels where id=p_duel and uid in(host_id,red_user,blue_user);
 if d.id is null then raise exception 'لا تملك صلاحية عرض هذه المواجهة'; end if;
 is_host:=uid=d.host_id; me:=case when uid=d.red_user then d.red_user when uid=d.blue_user then d.blue_user else null end;
 select * into q from ihyaa_duel_questions where duel_id=p_duel and question_no=d.current_no;
 select jsonb_build_object('id',q.question_no,'category',q.category,'question',q.question_text,'options',q.options,'golden',q.is_golden) into answers;
 if is_host then
  select coalesce(jsonb_agg(jsonb_build_object('player_id',p.public_id,'username',p.username,'option',a.answer_option,'correct',a.is_correct,'points',a.points_awarded,'elapsed_ms',a.elapsed_ms,'received_at',a.received_at)),'[]'::jsonb) into my_answer
  from ihyaa_duel_answers a join ihyaa_profiles p on p.user_id=a.user_id where a.duel_id=p_duel and a.question_no=d.current_no;
  answers:=answers||jsonb_build_object('correct_option',q.correct_option);
 else
  select jsonb_build_object('answered',true,'correct',is_correct,'points',points_awarded) into my_answer from ihyaa_duel_answers where duel_id=p_duel and question_no=d.current_no and user_id=uid;
 end if;
 select username into red_name from ihyaa_profiles where user_id=d.red_user;
 select username into blue_name from ihyaa_profiles where user_id=d.blue_user;
 return jsonb_build_object('duel_id',d.id,'code',d.code,'status',d.status,'question_no',d.current_no,'question',answers,'my_answer',my_answer,'host_answers',case when is_host then my_answer else null end,'red',jsonb_build_object('name',red_name,'score',d.red_score,'correct',d.red_correct,'wrong',d.red_wrong),'blue',jsonb_build_object('name',blue_name,'score',d.blue_score,'correct',d.blue_correct,'wrong',d.blue_wrong),'winner_id',d.winner_id,'started_at',d.started_at,'finished_at',d.finished_at,'settings',d.settings);
end $$;

create or replace function public.ihyaa_duel_history()
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'code',d.code,'status',d.status,'created_at',d.created_at,'finished_at',d.finished_at,'winner_id',d.winner_id,'red_name',rp.username,'blue_name',bp.username,'red_score',d.red_score,'blue_score',d.blue_score) order by d.created_at desc),'[]'::jsonb)
 into v from ihyaa_duels d join ihyaa_profiles rp on rp.user_id=d.red_user join ihyaa_profiles bp on bp.user_id=d.blue_user where d.host_id=auth.uid() or auth.uid() in(d.red_user,d.blue_user);
 return v;
end $$;

create or replace function public.ihyaa_duel_adjust(p_duel uuid,p_user uuid,p_delta integer,p_reason text)
returns boolean language plpgsql security definer set search_path=public,auth as $$
declare d ihyaa_duels;
begin
 select * into d from ihyaa_duels where id=p_duel and host_id=auth.uid() for update;
 if d.id is null or d.status in('completed','cancelled') then raise exception 'لا يمكن تعديل هذه المواجهة'; end if;
 if p_user=d.red_user then update ihyaa_duels set red_score=greatest(0,red_score+p_delta),updated_at=now() where id=p_duel;
 elsif p_user=d.blue_user then update ihyaa_duels set blue_score=greatest(0,blue_score+p_delta),updated_at=now() where id=p_duel;
 else raise exception 'اللاعب ليس مشاركًا في هذه المواجهة'; end if;
 insert into ihyaa_duel_events(duel_id,actor_id,event_type,details) values(p_duel,auth.uid(),'score_adjustment',jsonb_build_object('user_id',p_user,'delta',p_delta,'reason',left(coalesce(p_reason,''),300)));
 return true;
end $$;

do $$ begin
 alter publication supabase_realtime add table public.ihyaa_duels;
exception when duplicate_object then null; when undefined_object then null; end $$;

grant execute on function public.ihyaa_duel_bank_save(uuid,text,text,jsonb,smallint) to authenticated;
grant execute on function public.ihyaa_duel_bank_delete(uuid) to authenticated;
grant execute on function public.ihyaa_duel_bank_list() to authenticated;
grant execute on function public.ihyaa_duel_create(text,text,uuid[],jsonb) to authenticated;
grant execute on function public.ihyaa_duel_start(uuid) to authenticated;
grant execute on function public.ihyaa_duel_answer(uuid,smallint,integer) to authenticated;
grant execute on function public.ihyaa_duel_advance(uuid) to authenticated;
grant execute on function public.ihyaa_duel_control(uuid,text,jsonb) to authenticated;
grant execute on function public.ihyaa_duel_view(uuid) to authenticated;
grant execute on function public.ihyaa_duel_history() to authenticated;
grant execute on function public.ihyaa_duel_adjust(uuid,uuid,integer,text) to authenticated;


-- Include participant identity in the safe view so the client can render
-- host controls only for the host and label the player's own side.
create or replace function public.ihyaa_duel_view(p_duel uuid)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare d ihyaa_duels; q ihyaa_duel_questions; uid uuid; is_host boolean; me_team text; answers jsonb; own_answer jsonb; red_name text; blue_name text;
begin
 uid:=auth.uid(); select * into d from ihyaa_duels where id=p_duel and uid in(host_id,red_user,blue_user);
 if d.id is null then raise exception 'لا تملك صلاحية عرض هذه المواجهة'; end if;
 is_host:=uid=d.host_id;
 me_team:=case when uid=d.red_user then 'red' when uid=d.blue_user then 'blue' else null end;
 select * into q from ihyaa_duel_questions where duel_id=p_duel and question_no=d.current_no;
 answers:=case when q.question_no is null then null else jsonb_build_object('id',q.question_no,'category',q.category,'question',q.question_text,'options',q.options,'golden',q.is_golden) end;
 if is_host then
  select coalesce(jsonb_agg(jsonb_build_object('player_id',p.public_id,'username',p.username,'option',a.answer_option,'correct',a.is_correct,'points',a.points_awarded,'elapsed_ms',a.elapsed_ms,'received_at',a.received_at)),'[]'::jsonb) into own_answer
  from ihyaa_duel_answers a join ihyaa_profiles p on p.user_id=a.user_id where a.duel_id=p_duel and a.question_no=d.current_no;
  if answers is not null then answers:=answers||jsonb_build_object('correct_option',q.correct_option); end if;
 else
  select jsonb_build_object('answered',true,'correct',is_correct,'points',points_awarded) into own_answer from ihyaa_duel_answers where duel_id=p_duel and question_no=d.current_no and user_id=uid;
 end if;
 select username into red_name from ihyaa_profiles where user_id=d.red_user;
 select username into blue_name from ihyaa_profiles where user_id=d.blue_user;
 return jsonb_build_object('duel_id',d.id,'code',d.code,'status',d.status,'question_no',d.current_no,'question',answers,'my_answer',case when is_host then null else own_answer end,'host_answers',case when is_host then own_answer else null end,'is_host',is_host,'my_team',me_team,'red_user',d.red_user,'blue_user',d.blue_user,'red',jsonb_build_object('name',red_name,'score',d.red_score,'correct',d.red_correct,'wrong',d.red_wrong),'blue',jsonb_build_object('name',blue_name,'score',d.blue_score,'correct',d.blue_correct,'wrong',d.blue_wrong),'winner_id',d.winner_id,'started_at',d.started_at,'finished_at',d.finished_at,'settings',d.settings);
end $$;


-- Player RPC payloads are deliberately restricted to the caller's own identity,
-- score and answer. Only the host receives both sides' names, IDs and scores.
create or replace function public.ihyaa_duel_view(p_duel uuid)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare d ihyaa_duels; q ihyaa_duel_questions; uid uuid; is_host boolean; me_team text; answers jsonb; own_answer jsonb; red_name text; blue_name text;
begin
 uid:=auth.uid(); select * into d from ihyaa_duels where id=p_duel and uid in(host_id,red_user,blue_user);
 if d.id is null then raise exception 'لا تملك صلاحية عرض هذه المواجهة'; end if;
 is_host:=uid=d.host_id;
 me_team:=case when uid=d.red_user then 'red' when uid=d.blue_user then 'blue' else null end;
 select * into q from ihyaa_duel_questions where duel_id=p_duel and question_no=d.current_no;
 answers:=case when q.question_no is null then null else jsonb_build_object('id',q.question_no,'category',q.category,'question',q.question_text,'options',q.options,'golden',q.is_golden) end;
 if is_host then
  select coalesce(jsonb_agg(jsonb_build_object('player_id',p.public_id,'username',p.username,'option',a.answer_option,'correct',a.is_correct,'points',a.points_awarded,'elapsed_ms',a.elapsed_ms,'received_at',a.received_at)),'[]'::jsonb) into own_answer
  from ihyaa_duel_answers a join ihyaa_profiles p on p.user_id=a.user_id where a.duel_id=p_duel and a.question_no=d.current_no;
  if answers is not null then answers:=answers||jsonb_build_object('correct_option',q.correct_option); end if;
 else
  select jsonb_build_object('answered',true,'correct',is_correct,'points',points_awarded) into own_answer from ihyaa_duel_answers where duel_id=p_duel and question_no=d.current_no and user_id=uid;
 end if;
 if is_host or me_team='red' then select username into red_name from ihyaa_profiles where user_id=d.red_user; end if;
 if is_host or me_team='blue' then select username into blue_name from ihyaa_profiles where user_id=d.blue_user; end if;
 return jsonb_build_object(
  'duel_id',d.id,'code',d.code,'status',d.status,'question_no',d.current_no,'question',answers,
  'my_answer',case when is_host then null else own_answer end,
  'host_answers',case when is_host then own_answer else null end,
  'is_host',is_host,'my_team',me_team,
  'red_user',case when is_host then d.red_user else null end,
  'blue_user',case when is_host then d.blue_user else null end,
  'red',case when is_host or me_team='red' then jsonb_build_object('name',red_name,'score',d.red_score,'correct',d.red_correct,'wrong',d.red_wrong) else null end,
  'blue',case when is_host or me_team='blue' then jsonb_build_object('name',blue_name,'score',d.blue_score,'correct',d.blue_correct,'wrong',d.blue_wrong) else null end,
  'winner_id',case when is_host then d.winner_id else null end,
  'winner_is_me',d.winner_id=uid,
  'started_at',d.started_at,'finished_at',d.finished_at,'settings',d.settings
 );
end $$;

create or replace function public.ihyaa_duel_history()
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',d.id,'code',d.code,'status',d.status,'created_at',d.created_at,'finished_at',d.finished_at,
  'is_host',d.host_id=auth.uid(),
  'red_name',case when d.host_id=auth.uid() or d.red_user=auth.uid() then rp.username else 'المنافس' end,
  'blue_name',case when d.host_id=auth.uid() or d.blue_user=auth.uid() then bp.username else 'المنافس' end,
  'red_score',case when d.host_id=auth.uid() or d.red_user=auth.uid() then d.red_score else null end,
  'blue_score',case when d.host_id=auth.uid() or d.blue_user=auth.uid() then d.blue_score else null end,
  'winner_id',case when d.host_id=auth.uid() then d.winner_id else null end,
  'winner_is_me',d.winner_id=auth.uid()
 ) order by d.created_at desc),'[]'::jsonb)
 into v from ihyaa_duels d join ihyaa_profiles rp on rp.user_id=d.red_user join ihyaa_profiles bp on bp.user_id=d.blue_user
 where d.host_id=auth.uid() or auth.uid() in(d.red_user,d.blue_user);
 return v;
end $$;


-- Realtime carries only a non-sensitive state signal. Full match rows remain
-- inaccessible to clients; participants must call the role-filtered view RPC.
create table if not exists public.ihyaa_duel_signals (
 duel_id uuid primary key references public.ihyaa_duels(id) on delete cascade,
 version bigint not null default 1,
 status text not null,
 current_no smallint not null,
 updated_at timestamptz not null default now()
);
alter table public.ihyaa_duel_signals enable row level security;
drop policy if exists ihyaa_duel_signal_participant on public.ihyaa_duel_signals;
create or replace function public.ihyaa_duel_signal_visible(p_duel uuid)
returns boolean language sql stable security definer set search_path=public,auth as $$
 select exists(select 1 from public.ihyaa_duels d where d.id=p_duel and auth.uid() in(d.host_id,d.red_user,d.blue_user))
$$;
create policy ihyaa_duel_signal_participant on public.ihyaa_duel_signals for select to authenticated using(public.ihyaa_duel_signal_visible(duel_id));
revoke all on public.ihyaa_duel_signals from anon,authenticated;
grant select on public.ihyaa_duel_signals to authenticated;
revoke all on public.ihyaa_duels from anon,authenticated;
drop policy if exists ihyaa_duels_participants_read on public.ihyaa_duels;

create or replace function public.ihyaa_duel_signal_sync()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.ihyaa_duel_signals as current_signal(duel_id,version,status,current_no,updated_at)
 values(new.id,1,new.status,new.current_no,new.updated_at)
 on conflict(duel_id) do update set version=current_signal.version+1,status=excluded.status,current_no=excluded.current_no,updated_at=excluded.updated_at;
 return new;
end $$;
drop trigger if exists ihyaa_duel_signal_after_change on public.ihyaa_duels;
create trigger ihyaa_duel_signal_after_change after insert or update on public.ihyaa_duels
for each row execute function public.ihyaa_duel_signal_sync();

do $$ begin
 alter publication supabase_realtime drop table public.ihyaa_duels;
exception when undefined_object then null; when invalid_parameter_value then null; end $$;
do $$ begin
 alter publication supabase_realtime add table public.ihyaa_duel_signals;
exception when duplicate_object then null; when undefined_object then null; end $$;
