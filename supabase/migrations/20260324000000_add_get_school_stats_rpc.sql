-- Consolidate dashboard statistics counts into single RPC function
-- Reduces 6 separate count queries to 1 backend call
-- Improves performance and reduces query overhead

CREATE OR REPLACE FUNCTION public.get_school_stats(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_students int;
  v_active_students int;
  v_total_teachers int;
  v_total_classes int;
  v_total_subjects int;
  v_recent_admissions int;
  v_thirty_days_ago date;
BEGIN
  -- Calculate date 30 days ago
  v_thirty_days_ago := CURRENT_DATE - INTERVAL '30 days';
  
  -- Count total students
  SELECT COUNT(*) INTO v_total_students
  FROM public.students
  WHERE school_id = p_school_id;
  
  -- Count active students
  SELECT COUNT(*) INTO v_active_students
  FROM public.students
  WHERE school_id = p_school_id
  AND status = 'active';
  
  -- Count total teachers
  SELECT COUNT(*) INTO v_total_teachers
  FROM public.teachers
  WHERE school_id = p_school_id
  AND is_active = true;
  
  -- Count total classes
  SELECT COUNT(*) INTO v_total_classes
  FROM public.classes
  WHERE school_id = p_school_id
  AND is_active = true;
  
  -- Count total subjects
  SELECT COUNT(*) INTO v_total_subjects
  FROM public.subjects
  WHERE school_id = p_school_id
  AND is_active = true;
  
  -- Count recent admissions (last 30 days)
  SELECT COUNT(*) INTO v_recent_admissions
  FROM public.students
  WHERE school_id = p_school_id
  AND admission_date >= v_thirty_days_ago;
  
  -- Return all stats as single JSON object
  RETURN jsonb_build_object(
    'totalStudents', COALESCE(v_total_students, 0),
    'activeStudents', COALESCE(v_active_students, 0),
    'totalTeachers', COALESCE(v_total_teachers, 0),
    'totalClasses', COALESCE(v_total_classes, 0),
    'totalSubjects', COALESCE(v_total_subjects, 0),
    'recentAdmissions', COALESCE(v_recent_admissions, 0)
  );
EXCEPTION WHEN OTHERS THEN
  -- Log error and return safe default
  RAISE WARNING 'Error in get_school_stats for school_id %: %', p_school_id, SQLERRM;
  RETURN jsonb_build_object(
    'totalStudents', 0,
    'activeStudents', 0,
    'totalTeachers', 0,
    'totalClasses', 0,
    'totalSubjects', 0,
    'recentAdmissions', 0
  );
END;
$$;

-- Grant execute permission to authenticated users (school admins)
GRANT EXECUTE ON FUNCTION public.get_school_stats(uuid) TO authenticated;

-- Create index on admission_date for faster date range queries
CREATE INDEX IF NOT EXISTS idx_students_school_admission_date
ON public.students(school_id, admission_date)
WHERE status = 'active';

-- Create composite index for active counts
CREATE INDEX IF NOT EXISTS idx_students_school_status
ON public.students(school_id, status);

CREATE INDEX IF NOT EXISTS idx_teachers_school_active
ON public.teachers(school_id, is_active)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_classes_school_active
ON public.classes(school_id, is_active)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_subjects_school_active
ON public.subjects(school_id, is_active)
WHERE is_active = true;
