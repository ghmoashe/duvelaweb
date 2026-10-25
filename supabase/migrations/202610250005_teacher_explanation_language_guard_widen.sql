-- Aligns the explanation-language guard (202610250004) with the Business and
-- web pickers (shared/teaching-languages.ts teacherExplanationLanguages): a
-- teacher may explain in the languages chosen in the teacher profile, the
-- native language and the languages they teach. A profile that names no
-- language at all is not restricted, as in the pickers.
--
-- Without this, 4 of 6 teachers (no explanation_languages yet) could not
-- create courses, events or posts with an explanation language, nor start a
-- LIVE from Business builds that default it to the native language.

-- Same keys and spellings as normalizeTeachingLanguage / teachingLanguageKeyForLocale.
create or replace function public.normalize_teaching_language_key(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when v = '' then null
    when v in ('arabic','azerbaijani','bengali','chinese','czech','danish','dutch','english','estonian','farsi',
               'finnish','french','german','greek','hebrew','hindi','hungarian','indonesian','italian','japanese',
               'korean','norwegian','polish','portuguese','romanian','russian','serbian','slovak','spanish','swedish',
               'thai','turkish','ukrainian','urdu','uzbek','vietnamese') then v
    else coalesce(
      (select a.key from (values
        ('persian','farsi'),('deutsch','german'),('espanol','spanish'),('español','spanish'),('francais','french'),
        ('français','french'),('italiano','italian'),('portugues','portuguese'),('português','portuguese'),
        ('русский','russian'),('türkçe','turkish'),('turkce','turkish'),('svenska','swedish'),('norsk','norwegian'),
        ('polski','polish'),('čeština','czech'),('cestina','czech'),('nederlands','dutch'),('中文','chinese'),
        ('한국어','korean'),('日本語','japanese'),('العربية','arabic'),('oʻzbekcha','uzbek'),('ozbekcha','uzbek'),
        ('azərbaycanca','azerbaijani')) as a(alias, key) where a.alias = v),
      (select l.key from (values
        ('en','english'),('de','german'),('es','spanish'),('fr','french'),('it','italian'),('pt','portuguese'),
        ('nl','dutch'),('sv','swedish'),('no','norwegian'),('da','danish'),('fi','finnish'),('ro','romanian'),
        ('sr','serbian'),('pl','polish'),('cs','czech'),('tr','turkish'),('ru','russian'),('uk','ukrainian'),
        ('az','azerbaijani'),('uz','uzbek'),('fa','farsi'),('ar','arabic'),('vi','vietnamese'),('zh','chinese'),
        ('ja','japanese'),('ko','korean')) as l(code, key) where l.code = split_part(split_part(v, '-', 1), '_', 1)),
      v)
  end
  from (select lower(trim(coalesce(value, ''))) as v) s;
$$;

create or replace function public.assert_teacher_explanation_languages(owner_id uuid, requested_languages text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_languages text[];
  unsupported text[];
begin
  if coalesce(array_length(requested_languages, 1), 0) = 0 then return; end if;

  select array_agg(distinct known.key) filter (where known.key is not null)
    into allowed_languages
  from public.profiles p,
    lateral unnest(coalesce(p.explanation_languages, '{}'::text[])
                   || coalesce(p.teaches_languages, '{}'::text[])
                   || array[p.language]) as raw(value),
    lateral (select public.normalize_teaching_language_key(raw.value) as key) known
  where p.id = owner_id;

  -- A profile that names no language at all is not restricted.
  if coalesce(array_length(allowed_languages, 1), 0) = 0 then return; end if;

  select array_agg(distinct requested.key)
    into unsupported
  from unnest(requested_languages) as raw(value),
    lateral (select public.normalize_teaching_language_key(raw.value) as key) requested
  where requested.key is not null and not (requested.key = any(allowed_languages));

  if coalesce(array_length(unsupported, 1), 0) > 0 then
    raise exception 'Explanation language is not declared by this teacher: %', array_to_string(unsupported, ', ');
  end if;
end;
$$;
