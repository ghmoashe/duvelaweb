-- Prevent concurrent teaching sessions across Zoom Classroom and Agora LIVE.
-- Apply through the normal Supabase migration workflow. Not deployed by UI changes.
BEGIN;
CREATE OR REPLACE FUNCTION public.guard_teacher_live_session()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE host_id uuid;
BEGIN
  IF NEW.status <> 'live' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'live_sessions' THEN host_id := NEW.teacher_id;
  ELSE SELECT teacher_id INTO host_id FROM public.classes WHERE id=NEW.class_id;
    host_id := COALESCE(host_id,NEW.created_by); END IF;
  IF host_id IS NULL THEN RAISE EXCEPTION 'A session host is required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(host_id::text, 4100));
  IF EXISTS (SELECT 1 FROM public.live_sessions l WHERE l.teacher_id=host_id AND l.status='live'
    AND NOT (TG_TABLE_NAME='live_sessions' AND l.id=NEW.id))
    OR EXISTS (SELECT 1 FROM public.class_sessions c LEFT JOIN public.classes g ON g.id=c.class_id WHERE (c.created_by=host_id OR g.teacher_id=host_id) AND c.status='live'
    AND NOT (TG_TABLE_NAME='class_sessions' AND c.id=NEW.id)) THEN
    RAISE EXCEPTION 'Another teaching session is already live. End it before starting another.' USING ERRCODE='23505';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_teacher_live_session() FROM PUBLIC;
DROP TRIGGER IF EXISTS guard_teacher_live_session ON public.live_sessions;
CREATE TRIGGER guard_teacher_live_session BEFORE INSERT OR UPDATE OF status ON public.live_sessions
  FOR EACH ROW EXECUTE FUNCTION public.guard_teacher_live_session();
DROP TRIGGER IF EXISTS guard_teacher_classroom_session ON public.class_sessions;
CREATE TRIGGER guard_teacher_classroom_session BEFORE INSERT OR UPDATE OF status ON public.class_sessions
  FOR EACH ROW EXECUTE FUNCTION public.guard_teacher_live_session();
COMMIT;
