-- Add persistent system settings for super admin controls
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text NOT NULL UNIQUE DEFAULT 'global',
  maintenance_mode boolean NOT NULL DEFAULT false,
  allow_registrations boolean NOT NULL DEFAULT true,
  default_school_type text NOT NULL DEFAULT 'secondary',
  max_students_per_class integer NOT NULL DEFAULT 40 CHECK (max_students_per_class > 0 AND max_students_per_class <= 200),
  academic_year_start date NOT NULL DEFAULT make_date(EXTRACT(YEAR FROM now())::int, 1, 1),
  academic_year_end date NOT NULL DEFAULT make_date(EXTRACT(YEAR FROM now())::int, 12, 31),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Super admins can create system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Super admins can update system settings" ON public.system_settings;

CREATE POLICY "Super admins can view system settings"
ON public.system_settings
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::user_role));

CREATE POLICY "Super admins can create system settings"
ON public.system_settings
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'::user_role));

CREATE POLICY "Super admins can update system settings"
ON public.system_settings
FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::user_role));

CREATE OR REPLACE FUNCTION public.update_system_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER set_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_system_settings_updated_at();

INSERT INTO public.system_settings (
  config_key,
  maintenance_mode,
  allow_registrations,
  default_school_type,
  max_students_per_class,
  academic_year_start,
  academic_year_end
)
VALUES (
  'global',
  false,
  true,
  'secondary',
  40,
  make_date(EXTRACT(YEAR FROM now())::int, 1, 1),
  make_date(EXTRACT(YEAR FROM now())::int, 12, 31)
)
ON CONFLICT (config_key) DO NOTHING;