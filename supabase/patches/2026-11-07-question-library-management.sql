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
