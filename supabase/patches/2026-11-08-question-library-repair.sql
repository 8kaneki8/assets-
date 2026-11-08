-- مؤسسة إحياء | Idempotent saved-question-library repair
-- Run this complete file once in the Supabase SQL Editor for the project configured in supabase-config.js.
-- Safe to re-run: creates the table/index if absent and replaces the RPC functions/grants.

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


-- Personal quiz library. Saved templates are private to their owner.
create table if not exists public.ihyaa_saved_quizzes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 70),
  questions jsonb not null check (jsonb_typeof(questions)='array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ihyaa_saved_quizzes_owner_updated
  on public.ihyaa_saved_quizzes(owner_id, updated_at desc);

alter table public.ihyaa_saved_quizzes enable row level security;
revoke all on public.ihyaa_saved_quizzes from anon, authenticated;

create or replace function public.ihyaa_save_quiz(p_title text,p_questions jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,extensions
as $$
declare saved public.ihyaa_saved_quizzes;
begin
  if auth.uid() is null then raise exception 'سجّل الدخول أولًا'; end if;
  if not exists(select 1 from public.ihyaa_profiles where user_id=auth.uid()) then
    raise exception 'أنشئ ملف اللاعب بالاسم أولًا';
  end if;
  if char_length(trim(coalesce(p_title,''))) not between 2 and 70 then
    raise exception 'اسم المسابقة يجب أن يكون من حرفين إلى 70 حرفًا';
  end if;
  if jsonb_typeof(p_questions) is distinct from 'array' then
    raise exception 'بيانات الأسئلة غير صالحة';
  end if;
  if jsonb_array_length(p_questions) not between 1 and 200 then
    raise exception 'المسابقة يجب أن تحتوي من سؤال واحد إلى 200 سؤال';
  end if;
  if exists(
    select 1 from jsonb_array_elements(p_questions) q
    where nullif(trim(coalesce(q->>'question','')),'') is null
       or nullif(trim(coalesce(q->>'answer','')),'') is null
  ) then
    raise exception 'يوجد سؤال أو إجابة فارغة؛ أكمل البيانات أولًا';
  end if;

  insert into public.ihyaa_saved_quizzes(owner_id,title,questions)
  values(auth.uid(),trim(p_title),p_questions)
  returning * into saved;

  return jsonb_build_object('id',saved.id,'title',saved.title,'question_count',jsonb_array_length(saved.questions));
end;
$$;

create or replace function public.ihyaa_list_saved_quizzes()
returns jsonb
language sql
stable
security definer
set search_path=public,auth
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',q.id,
        'title',q.title,
        'question_count',jsonb_array_length(q.questions),
        'created_at',q.created_at,
        'updated_at',q.updated_at
      ) order by q.updated_at desc
    ),
    '[]'::jsonb
  )
  from public.ihyaa_saved_quizzes q
  where q.owner_id=auth.uid();
$$;

create or replace function public.ihyaa_get_saved_quiz(p_quiz uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
declare q public.ihyaa_saved_quizzes;
begin
  select * into q from public.ihyaa_saved_quizzes
  where id=p_quiz and owner_id=auth.uid();
  if q.id is null then raise exception 'المسابقة المحفوظة غير موجودة'; end if;
  return jsonb_build_object('id',q.id,'title',q.title,'questions',q.questions);
end;
$$;

create or replace function public.ihyaa_delete_saved_quiz(p_quiz uuid)
returns boolean
language plpgsql
security definer
set search_path=public,auth
as $$
declare affected integer;
begin
  delete from public.ihyaa_saved_quizzes where id=p_quiz and owner_id=auth.uid();
  get diagnostics affected = row_count;
  return affected=1;
end;
$$;

revoke all on function public.ihyaa_save_quiz(text,jsonb) from public,anon;
revoke all on function public.ihyaa_list_saved_quizzes() from public,anon;
revoke all on function public.ihyaa_get_saved_quiz(uuid) from public,anon;
revoke all on function public.ihyaa_delete_saved_quiz(uuid) from public,anon;
grant execute on function public.ihyaa_save_quiz(text,jsonb) to authenticated;
grant execute on function public.ihyaa_list_saved_quizzes() to authenticated;
grant execute on function public.ihyaa_get_saved_quiz(uuid) to authenticated;
grant execute on function public.ihyaa_delete_saved_quiz(uuid) to authenticated;


-- مؤسسة إحياء | Question library management
-- Run once after 2026-11-07-public-room-discovery.sql in Supabase SQL Editor.
-- Updates an owned saved quiz in place; it does not create a replacement row.

create or replace function public.ihyaa_update_saved_quiz(
  p_quiz uuid,
  p_title text,
  p_questions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,extensions
as $$
declare
  updated public.ihyaa_saved_quizzes;
begin
  if auth.uid() is null then
    raise exception 'سجّل الدخول أولًا';
  end if;

  if char_length(trim(coalesce(p_title,''))) not between 2 and 70 then
    raise exception 'اسم المجموعة يجب أن يكون من حرفين إلى 70 حرفًا';
  end if;

  if jsonb_typeof(p_questions) is distinct from 'array' then
    raise exception 'بيانات الأسئلة غير صالحة';
  end if;

  if jsonb_array_length(p_questions) not between 1 and 200 then
    raise exception 'المجموعة يجب أن تحتوي من سؤال واحد إلى 200 سؤال';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_questions) as item(value)
    where jsonb_typeof(item.value) is distinct from 'object'
       or nullif(trim(coalesce(item.value->>'question','')),'') is null
       or nullif(trim(coalesce(item.value->>'answer','')),'') is null
       or not (
         case
           when coalesce(item.value->>'points','100') ~ '^[0-9]{1,5}$'
           then coalesce(item.value->>'points','100')::integer between 1 and 10000
           else false
         end
       )
       or not (
         case
           when coalesce(item.value->>'seconds','30') ~ '^[0-9]{1,3}$'
           then coalesce(item.value->>'seconds','30')::integer between 5 and 300
           else false
         end
       )
  ) then
    raise exception 'تحقق من نص كل سؤال وإجابته والنقاط والوقت المحدد';
  end if;

  update public.ihyaa_saved_quizzes
  set title=trim(p_title),
      questions=p_questions,
      updated_at=now()
  where id=p_quiz
    and owner_id=auth.uid()
  returning * into updated;

  if updated.id is null then
    raise exception 'المجموعة غير موجودة أو لا تملك صلاحية تعديلها';
  end if;

  return jsonb_build_object(
    'id',updated.id,
    'title',updated.title,
    'question_count',jsonb_array_length(updated.questions),
    'updated_at',updated.updated_at
  );
end;
$$;

revoke all on function public.ihyaa_update_saved_quiz(uuid,text,jsonb) from public,anon;
grant execute on function public.ihyaa_update_saved_quiz(uuid,text,jsonb) to authenticated;


-- Ask PostgREST to refresh its function schema cache after the migration.
notify pgrst, 'reload schema';
