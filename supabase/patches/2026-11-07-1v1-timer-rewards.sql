-- 2026-11-07: 1v1 timer, timeout handling, resumable host sessions and winner reward.
-- Apply once AFTER 2026-11-07-1v1-duels.sql.

alter table public.ihyaa_duels
  add column if not exists question_deadline timestamptz,
  add column if not exists paused_at timestamptz;

-- Keep the active question timer server-authoritative.
create or replace function public.ihyaa_duel_create(
  p_red_id text,p_blue_id text,p_question_ids uuid[],p_settings jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare red uuid; blue uuid; d public.ihyaa_duels;
begin
  if auth.uid() is null then raise exception 'سجّل الدخول أولاً'; end if;
  select user_id into red from public.ihyaa_profiles where public_id=upper(trim(coalesce(p_red_id,'')));
  select user_id into blue from public.ihyaa_profiles where public_id=upper(trim(coalesce(p_blue_id,'')));
  if red is null or blue is null or red=blue then raise exception 'تحقق من معرفَي اللاعبين؛ يجب أن يكونا لاعبين مختلفين'; end if;
  if auth.uid() in(red,blue) then raise exception 'يجب أن يكون الهوست منفصلًا عن لاعبي المواجهة'; end if;
  if coalesce(array_length(p_question_ids,1),0)<>16 then raise exception 'اختر 15 سؤالًا وسؤالًا ذهبيًا واحدًا'; end if;
  if (select count(distinct x) from unnest(p_question_ids) x)<>16 then raise exception 'لا يمكن تكرار السؤال داخل المواجهة'; end if;
  if exists(select 1 from unnest(p_question_ids) x left join public.ihyaa_duel_bank b on b.id=x and b.owner_id=auth.uid() and b.active where b.id is null) then
    raise exception 'يوجد سؤال غير صالح أو لا تملكه';
  end if;
  insert into public.ihyaa_duels(host_id,red_user,blue_user,settings)
  values(auth.uid(),red,blue,jsonb_build_object(
    'correct_points',greatest(0,least(10000,coalesce((p_settings->>'correct_points')::int,100))),
    'last_question_points',greatest(0,least(10000,coalesce((p_settings->>'last_question_points')::int,200))),
    'winner_reward',greatest(0,least(10000,coalesce((p_settings->>'winner_reward')::int,600))),
    'question_seconds',greatest(10,least(180,coalesce((p_settings->>'question_seconds')::int,30)))
  )) returning * into d;
  insert into public.ihyaa_duel_questions(duel_id,question_no,category,question_text,options,correct_option,is_golden)
  select d.id,x.ordinality::smallint,b.category,b.question_text,b.options,b.correct_option,x.ordinality=16
  from unnest(p_question_ids) with ordinality x(id,ordinality)
  join public.ihyaa_duel_bank b on b.id=x.id;
  insert into public.ihyaa_duel_events(duel_id,actor_id,event_type,details)
  values(d.id,auth.uid(),'created',jsonb_build_object('red_id',p_red_id,'blue_id',p_blue_id,'question_count',16));
  return jsonb_build_object('duel_id',d.id,'code',d.code,'status',d.status);
end $$;

create or replace function public.ihyaa_duel_start(p_duel uuid)
returns boolean language plpgsql security definer set search_path=public,auth as $$
declare d public.ihyaa_duels;
begin
  select * into d from public.ihyaa_duels where id=p_duel and host_id=auth.uid() and status='lobby' for update;
  if d.id is null then raise exception 'لا يمكن بدء المواجهة؛ تحقق من صلاحية الهوست وحالة المواجهة'; end if;
  update public.ihyaa_duels set status='live',started_at=coalesce(started_at,now()),
    question_deadline=now()+make_interval(secs=>coalesce((settings->>'question_seconds')::int,30)),
    paused_at=null,updated_at=now() where id=p_duel;
  insert into public.ihyaa_duel_events(duel_id,actor_id,event_type) values(p_duel,auth.uid(),'started');
  return true;
end $$;

create or replace function public.ihyaa_duel_answer(p_duel uuid,p_option smallint,p_elapsed_ms integer default null)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare d public.ihyaa_duels; q public.ihyaa_duel_questions; good boolean; pts integer; uid uuid;
begin
  uid:=auth.uid();
  if uid is null or p_option not between 0 and 3 then raise exception 'اختيار الإجابة غير صالح؛ اختر إجابة من الخيارات الأربعة'; end if;
  select * into d from public.ihyaa_duels where id=p_duel for update;
  if d.id is null or uid not in(d.red_user,d.blue_user) then raise exception 'لا تملك صلاحية المشاركة في هذه المواجهة'; end if;
  if d.status not in('live','golden') then raise exception 'المواجهة متوقفة أو منتهية'; end if;
  if d.question_deadline is not null and clock_timestamp()>d.question_deadline then raise exception 'انتهى وقت السؤال؛ انتظر انتقال الهوست للسؤال التالي'; end if;
  select * into q from public.ihyaa_duel_questions where duel_id=p_duel and question_no=d.current_no;
  if q.question_no is null then raise exception 'السؤال الحالي غير متاح'; end if;
  if exists(select 1 from public.ihyaa_duel_answers where duel_id=p_duel and question_no=d.current_no and user_id=uid) then
    raise exception 'تم تسجيل إجابتك لهذا السؤال بالفعل';
  end if;
  good:=p_option=q.correct_option;
  pts:=case when good and d.status='live' and d.current_no=15 then (d.settings->>'last_question_points')::int
            when good and d.status='live' then (d.settings->>'correct_points')::int else 0 end;
  insert into public.ihyaa_duel_answers(duel_id,question_no,user_id,answer_option,is_correct,points_awarded,elapsed_ms)
  values(p_duel,d.current_no,uid,p_option,good,pts,greatest(0,least(3600000,coalesce(p_elapsed_ms,0))));
  if uid=d.red_user then
    update public.ihyaa_duels set red_score=red_score+pts,red_correct=red_correct+good::int,red_wrong=red_wrong+(not good)::int,updated_at=now() where id=p_duel;
  else
    update public.ihyaa_duels set blue_score=blue_score+pts,blue_correct=blue_correct+good::int,blue_wrong=blue_wrong+(not good)::int,updated_at=now() where id=p_duel;
  end if;
  return jsonb_build_object('accepted',true,'correct',good,'points',pts,'question_no',d.current_no);
end $$;

create or replace function public.ihyaa_duel_advance(p_duel uuid)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare d public.ihyaa_duels; cnt integer; red_answer public.ihyaa_duel_answers; blue_answer public.ihyaa_duel_answers;
  winner uuid; reward integer; timed_out integer:=0;
begin
  select * into d from public.ihyaa_duels where id=p_duel and host_id=auth.uid() for update;
  if d.id is null then raise exception 'الهوست فقط يستطيع تحريك المواجهة'; end if;
  if d.status not in('live','golden') then raise exception 'المواجهة ليست في حالة تسمح بالانتقال'; end if;
  select count(*) into cnt from public.ihyaa_duel_answers where duel_id=p_duel and question_no=d.current_no;
  if cnt<2 and (d.question_deadline is null or clock_timestamp()<d.question_deadline) then
    raise exception 'انتظر إجابة اللاعبين أو انتهاء المؤقّت';
  end if;

  select * into red_answer from public.ihyaa_duel_answers where duel_id=p_duel and question_no=d.current_no and user_id=d.red_user;
  select * into blue_answer from public.ihyaa_duel_answers where duel_id=p_duel and question_no=d.current_no and user_id=d.blue_user;
  if red_answer.id is null then
    update public.ihyaa_duels set red_wrong=red_wrong+1 where id=p_duel;
    timed_out:=timed_out+1;
  end if;
  if blue_answer.id is null then
    update public.ihyaa_duels set blue_wrong=blue_wrong+1 where id=p_duel;
    timed_out:=timed_out+1;
  end if;
  if timed_out>0 then
    insert into public.ihyaa_duel_events(duel_id,actor_id,event_type,details)
    values(p_duel,auth.uid(),'timeout',jsonb_build_object('question_no',d.current_no,'missing_answers',timed_out));
  end if;

  if d.status='golden' then
    if coalesce(red_answer.is_correct,false) and coalesce(blue_answer.is_correct,false) then
      winner:=case when red_answer.received_at<=blue_answer.received_at then d.red_user else d.blue_user end;
    elsif coalesce(red_answer.is_correct,false) then winner:=d.red_user;
    elsif coalesce(blue_answer.is_correct,false) then winner:=d.blue_user;
    else winner:=null;
    end if;
    reward:=coalesce((d.settings->>'winner_reward')::int,600);
    update public.ihyaa_duels set status='completed',winner_id=winner,finished_at=now(),
      red_score=red_score+case when winner=d.red_user then reward else 0 end,
      blue_score=blue_score+case when winner=d.blue_user then reward else 0 end,
      question_deadline=null,paused_at=null,updated_at=now() where id=p_duel;
    insert into public.ihyaa_duel_events(duel_id,actor_id,event_type,details)
    values(p_duel,auth.uid(),'completed',jsonb_build_object('winner_id',winner,'golden',true,'winner_reward',case when winner is null then 0 else reward end));
    return jsonb_build_object('status','completed','winner_id',winner,'winner_reward',case when winner is null then 0 else reward end);
  end if;

  if d.current_no<15 then
    update public.ihyaa_duels set current_no=current_no+1,
      question_deadline=now()+make_interval(secs=>coalesce((settings->>'question_seconds')::int,30)),
      updated_at=now() where id=p_duel;
    return jsonb_build_object('status','live','question_no',d.current_no+1);
  end if;

  if d.red_score>d.blue_score then winner:=d.red_user;
  elsif d.blue_score>d.red_score then winner:=d.blue_user;
  else winner:=null;
  end if;
  if winner is not null then
    reward:=coalesce((d.settings->>'winner_reward')::int,600);
    update public.ihyaa_duels set status='completed',winner_id=winner,finished_at=now(),
      red_score=red_score+case when winner=d.red_user then reward else 0 end,
      blue_score=blue_score+case when winner=d.blue_user then reward else 0 end,
      question_deadline=null,paused_at=null,updated_at=now() where id=p_duel;
    insert into public.ihyaa_duel_events(duel_id,actor_id,event_type,details)
    values(p_duel,auth.uid(),'completed',jsonb_build_object('winner_id',winner,'golden',false,'winner_reward',reward));
    return jsonb_build_object('status','completed','winner_id',winner,'winner_reward',reward);
  end if;

  update public.ihyaa_duels set status='golden',current_no=16,
    question_deadline=now()+make_interval(secs=>coalesce((settings->>'question_seconds')::int,30)),
    updated_at=now() where id=p_duel;
  return jsonb_build_object('status','golden','question_no',16);
end $$;

create or replace function public.ihyaa_duel_control(p_duel uuid,p_action text,p_details jsonb default '{}'::jsonb)
returns boolean language plpgsql security definer set search_path=public,auth as $$
declare d public.ihyaa_duels; winner uuid; reward integer;
begin
  select * into d from public.ihyaa_duels where id=p_duel and host_id=auth.uid() for update;
  if d.id is null then raise exception 'الهوست فقط يستطيع التحكم بالمواجهة'; end if;
  if p_action='pause' and d.status in('live','golden') then
    update public.ihyaa_duels set status='paused',paused_at=now(),updated_at=now() where id=p_duel;
  elsif p_action='resume' and d.status='paused' then
    update public.ihyaa_duels set status=case when current_no=16 then 'golden' else 'live' end,
      question_deadline=case when question_deadline is null then now()+make_interval(secs=>coalesce((settings->>'question_seconds')::int,30))
        else question_deadline+greatest(interval '0',now()-coalesce(paused_at,now())) end,
      paused_at=null,updated_at=now() where id=p_duel;
  elsif p_action='cancel' and d.status not in('completed','cancelled') then
    update public.ihyaa_duels set status='cancelled',finished_at=now(),question_deadline=null,paused_at=null,updated_at=now() where id=p_duel;
  elsif p_action='finish' and d.status in('live','paused','golden') then
    winner:=case when d.red_score=d.blue_score then null when d.red_score>d.blue_score then d.red_user else d.blue_user end;
    reward:=coalesce((d.settings->>'winner_reward')::int,600);
    update public.ihyaa_duels set status='completed',winner_id=winner,finished_at=now(),
      red_score=red_score+case when winner=d.red_user then reward else 0 end,
      blue_score=blue_score+case when winner=d.blue_user then reward else 0 end,
      question_deadline=null,paused_at=null,updated_at=now() where id=p_duel;
  else raise exception 'العملية غير متاحة في الحالة الحالية'; end if;
  insert into public.ihyaa_duel_events(duel_id,actor_id,event_type,details)
  values(p_duel,auth.uid(),'host_'||p_action,coalesce(p_details,'{}'::jsonb));
  return true;
end $$;

create or replace function public.ihyaa_duel_view(p_duel uuid)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare d public.ihyaa_duels; q public.ihyaa_duel_questions; uid uuid; is_host boolean; me_team text;
  answers jsonb; own_answer jsonb; red_name text; blue_name text;
begin
  uid:=auth.uid();
  select * into d from public.ihyaa_duels where id=p_duel and uid in(host_id,red_user,blue_user);
  if d.id is null then raise exception 'لا تملك صلاحية عرض هذه المواجهة'; end if;
  is_host:=uid=d.host_id;
  me_team:=case when uid=d.red_user then 'red' when uid=d.blue_user then 'blue' else null end;
  select * into q from public.ihyaa_duel_questions where duel_id=p_duel and question_no=d.current_no;
  answers:=case when q.question_no is null or d.status='lobby' then null
    else jsonb_build_object('id',q.question_no,'category',q.category,'question',q.question_text,'options',q.options,'golden',q.is_golden) end;
  if is_host then
    select coalesce(jsonb_agg(jsonb_build_object('player_id',p.public_id,'username',p.username,'option',a.answer_option,
      'correct',a.is_correct,'points',a.points_awarded,'elapsed_ms',a.elapsed_ms,'received_at',a.received_at)),'[]'::jsonb)
    into own_answer from public.ihyaa_duel_answers a join public.ihyaa_profiles p on p.user_id=a.user_id
    where a.duel_id=p_duel and a.question_no=d.current_no;
    if answers is not null then answers:=answers||jsonb_build_object('correct_option',q.correct_option); end if;
  else
    select jsonb_build_object('answered',true,'correct',is_correct,'points',points_awarded)
    into own_answer from public.ihyaa_duel_answers where duel_id=p_duel and question_no=d.current_no and user_id=uid;
  end if;
  if is_host or me_team='red' then select username into red_name from public.ihyaa_profiles where user_id=d.red_user; end if;
  if is_host or me_team='blue' then select username into blue_name from public.ihyaa_profiles where user_id=d.blue_user; end if;
  return jsonb_build_object(
    'duel_id',d.id,'code',d.code,'status',d.status,'question_no',d.current_no,
    'question',answers,'my_answer',case when is_host then null else own_answer end,
    'host_answers',case when is_host then own_answer else null end,'is_host',is_host,'my_team',me_team,
    'red_user',case when is_host then d.red_user else null end,'blue_user',case when is_host then d.blue_user else null end,
    'red',case when is_host or me_team='red' then jsonb_build_object('name',red_name,'score',d.red_score,'correct',d.red_correct,'wrong',d.red_wrong) else null end,
    'blue',case when is_host or me_team='blue' then jsonb_build_object('name',blue_name,'score',d.blue_score,'correct',d.blue_correct,'wrong',d.blue_wrong) else null end,
    'winner_id',case when is_host then d.winner_id else null end,'winner_is_me',d.winner_id=uid,
    'is_draw',d.status='completed' and d.winner_id is null,'question_deadline',d.question_deadline,
    'started_at',d.started_at,'finished_at',d.finished_at,'settings',d.settings
  );
end $$;

grant execute on function public.ihyaa_duel_create(text,text,uuid[],jsonb) to authenticated;
grant execute on function public.ihyaa_duel_start(uuid) to authenticated;
grant execute on function public.ihyaa_duel_answer(uuid,smallint,integer) to authenticated;
grant execute on function public.ihyaa_duel_advance(uuid) to authenticated;
grant execute on function public.ihyaa_duel_control(uuid,text,jsonb) to authenticated;
grant execute on function public.ihyaa_duel_view(uuid) to authenticated;
