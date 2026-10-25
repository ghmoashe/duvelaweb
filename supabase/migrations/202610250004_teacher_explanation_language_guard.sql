-- A teacher may publish an explanation only in a language declared on the profile.
create or replace function public.assert_teacher_explanation_languages(
  owner_id uuid,
  requested_languages text[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_languages text[];
  unsupported text[];
begin
  if coalesce(array_length(requested_languages, 1), 0) = 0 then
    return;
  end if;

  select coalesce(explanation_languages, '{}'::text[])
    into allowed_languages
    from public.profiles
   where id = owner_id;

  if allowed_languages is null or coalesce(array_length(allowed_languages, 1), 0) = 0 then
    raise exception 'Set explanation_languages on the teacher profile before publishing explanations';
  end if;

  select array_agg(requested.language)
    into unsupported
    from (
      select distinct lower(trim(language)) as language
        from unnest(requested_languages) as language
       where nullif(trim(language), '') is not null
    ) requested
   where not exists (
     select 1
       from unnest(allowed_languages) as allowed(language)
      where lower(trim(allowed.language)) = requested.language
   );

  if coalesce(array_length(unsupported, 1), 0) > 0 then
    raise exception 'Explanation language is not declared by this teacher: %', array_to_string(unsupported, ', ');
  end if;
end;
$$;

create or replace function public.guard_course_explanation_languages()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_teacher_explanation_languages(
    new.created_by,
    array_remove(array_cat(coalesce(new.explanation_languages, '{}'::text[]), array[new.explanation_language]), null)
  );
  return new;
end;
$$;

create or replace function public.guard_event_explanation_languages()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_teacher_explanation_languages(
    new.organizer_id,
    array_remove(array_cat(coalesce(new.explanation_languages, '{}'::text[]), array[new.explanation_language]), null)
  );
  return new;
end;
$$;

create or replace function public.guard_live_explanation_language()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_teacher_explanation_languages(new.teacher_id, array_remove(array[new.explanation_language], null));
  return new;
end;
$$;

create or replace function public.guard_post_explanation_languages()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_teacher_explanation_languages(
    new.user_id,
    array_remove(array_cat(coalesce(new.explanation_languages, '{}'::text[]), array[new.explanation_language]), null)
  );
  return new;
end;
$$;

drop trigger if exists courses_explanation_languages_guard on public.courses;
create trigger courses_explanation_languages_guard
before insert or update of explanation_language, explanation_languages, created_by on public.courses
for each row execute function public.guard_course_explanation_languages();

drop trigger if exists events_explanation_languages_guard on public.events;
create trigger events_explanation_languages_guard
before insert or update of explanation_language, explanation_languages, organizer_id on public.events
for each row execute function public.guard_event_explanation_languages();

drop trigger if exists live_sessions_explanation_language_guard on public.live_sessions;
create trigger live_sessions_explanation_language_guard
before insert or update of explanation_language, teacher_id on public.live_sessions
for each row execute function public.guard_live_explanation_language();

drop trigger if exists posts_explanation_languages_guard on public.posts;
create trigger posts_explanation_languages_guard
before insert or update of explanation_language, explanation_languages, user_id on public.posts
for each row execute function public.guard_post_explanation_languages();
