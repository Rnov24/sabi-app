-- ============================================================
-- Migration 005: Generate Join Codes for All Existing Courses
-- ============================================================

-- Create a temporary helper function to generate a random 6-character uppercase alphanumeric code
CREATE OR REPLACE FUNCTION public.generate_random_join_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Update existing courses where join_code is null
UPDATE public.courses
SET join_code = public.generate_random_join_code()
WHERE join_code IS NULL;

-- Drop the temporary helper function
DROP FUNCTION IF EXISTS public.generate_random_join_code();
