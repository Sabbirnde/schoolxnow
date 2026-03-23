-- Fix signup failures caused by schema drift in auth trigger
-- Ensures handle_new_user works whether user_profiles.role exists or not
-- and never blocks auth user creation on trigger errors.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role_value user_role := 'teacher'::user_role;
  profile_name text;
  school_uuid uuid := NULL;
  has_role_column boolean := false;
BEGIN
  profile_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'New User');

  -- Parse role safely; fallback to teacher for invalid role values
  BEGIN
    user_role_value := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'teacher'::user_role);
  EXCEPTION WHEN others THEN
    user_role_value := 'teacher'::user_role;
  END;

  -- Parse school_id safely; tolerate empty/invalid values
  BEGIN
    school_uuid := NULLIF(NEW.raw_user_meta_data->>'school_id', '')::uuid;
  EXCEPTION WHEN others THEN
    school_uuid := NULL;
  END;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'role'
  ) INTO has_role_column;

  IF has_role_column THEN
    INSERT INTO public.user_profiles (user_id, role, full_name, approval_status, school_id)
    VALUES (NEW.id, user_role_value, profile_name, 'approved', school_uuid)
    ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role,
        full_name = EXCLUDED.full_name,
        approval_status = EXCLUDED.approval_status,
        school_id = COALESCE(EXCLUDED.school_id, public.user_profiles.school_id);
  ELSE
    INSERT INTO public.user_profiles (user_id, full_name, approval_status, school_id)
    VALUES (NEW.id, profile_name, 'approved', school_uuid)
    ON CONFLICT (user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        approval_status = EXCLUDED.approval_status,
        school_id = COALESCE(EXCLUDED.school_id, public.user_profiles.school_id);
  END IF;

  -- Keep user_roles in sync for RBAC checks
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role_value)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Never block auth signup due to profile/role trigger issues
  RAISE WARNING 'handle_new_user warning for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
