-- ============================================================
-- SABI — Complete Schema Rebuild Script
-- WARNING: This will drop all existing tables, functions, and
-- triggers and recreate them from scratch. All data will be lost.
-- ============================================================

-- 1. DROP EXISTING TRIGGERS, FUNCTIONS, AND TABLES CASCADE
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.check_and_increment_rate_limit(UUID, TEXT, INT) CASCADE;

DROP TABLE IF EXISTS public.feed_reactions CASCADE;
DROP TABLE IF EXISTS public.rate_limits CASCADE;
DROP TABLE IF EXISTS public.llm_logs CASCADE;
DROP TABLE IF EXISTS public.reminder_logs CASCADE;
DROP TABLE IF EXISTS public.course_members CASCADE;
DROP TABLE IF EXISTS public.peer_posts CASCADE;
DROP TABLE IF EXISTS public.mastery_events CASCADE;
DROP TABLE IF EXISTS public.topics CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 2. CREATE TABLES
-- ============================================================

-- Profiles (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  university TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Courses: syllabus-based and free explore
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'syllabus' CHECK (source_type IN ('syllabus', 'free')),
  syllabus_url TEXT,
  exam_date DATE,
  level TEXT CHECK (level IN ('intro', 'intermediate', 'advanced')),
  join_code TEXT UNIQUE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Atomic topics
CREATE TABLE public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  parent_topic TEXT,
  difficulty TEXT CHECK (difficulty IN ('basic', 'intermediate', 'advanced')),
  display_order INT DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Mastery events
CREATE TABLE public.mastery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE NOT NULL,
  mastery_card_text TEXT NOT NULL,
  public_slug TEXT UNIQUE,
  rounds_taken INT NOT NULL DEFAULT 1,
  ease_factor FLOAT NOT NULL DEFAULT 2.5,
  interval_days INT NOT NULL DEFAULT 1,
  next_review_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Peer feed posts
CREATE TABLE public.peer_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mastery_event_id UUID REFERENCES public.mastery_events(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  is_visible BOOLEAN DEFAULT TRUE NOT NULL,
  helpful_count INT DEFAULT 0 NOT NULL,
  unclear_count INT DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Course memberships
CREATE TABLE public.course_members (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'student' CHECK (role IN ('student', 'lecturer')),
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, course_id)
);

-- Reminder logs
CREATE TABLE public.reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  total_due INT NOT NULL DEFAULT 0,
  emails_sent INT NOT NULL DEFAULT 0,
  errors INT NOT NULL DEFAULT 0
);

-- Rate limits
CREATE TABLE public.rate_limits (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, endpoint, date)
);

-- LLM usage logs
CREATE TABLE public.llm_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  route TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INT,
  output_tokens INT,
  duration_ms INT,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Feed Reactions
CREATE TABLE public.feed_reactions (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.peer_posts(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('helpful', 'unclear')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, post_id)
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX idx_courses_user_id ON public.courses(user_id);
CREATE INDEX idx_topics_course_id ON public.topics(course_id);
CREATE INDEX idx_mastery_events_user_id ON public.mastery_events(user_id);
CREATE INDEX idx_mastery_events_next_review ON public.mastery_events(next_review_date);
CREATE INDEX idx_mastery_events_slug ON public.mastery_events(public_slug);
CREATE INDEX idx_mastery_events_topic_id ON public.mastery_events(topic_id);
CREATE INDEX idx_llm_logs_created ON public.llm_logs(created_at);
CREATE INDEX idx_feed_reactions_post_id ON public.feed_reactions(post_id);
CREATE INDEX idx_course_members_course_id ON public.course_members(course_id);
CREATE INDEX idx_peer_posts_course_id ON public.peer_posts(course_id);
CREATE INDEX idx_peer_posts_mastery_event_id ON public.peer_posts(mastery_event_id);
CREATE INDEX idx_llm_logs_user_id ON public.llm_logs(user_id);

-- ============================================================
-- 4. TRIGGER FUNCTION FOR NEW USER SIGNUPS
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1), 'User')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 5. RATE LIMIT HELPER RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  p_user_id UUID,
  p_endpoint TEXT,
  p_max_per_day INT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO public.rate_limits (user_id, endpoint, date, count)
  VALUES (p_user_id, p_endpoint, CURRENT_DATE, 1)
  ON CONFLICT (user_id, endpoint, date)
  DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count INTO v_count;

  RETURN v_count <= p_max_per_day;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create security definer function to check course membership without RLS cycles
-- Create security definer function to check course membership without RLS cycles
CREATE OR REPLACE FUNCTION public.is_course_member(p_course_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Security best practice: ensure the caller can only query their own membership
  IF p_user_id != (SELECT auth.uid()) THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.course_members
    WHERE course_id = p_course_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_reactions ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING ((SELECT auth.uid()) = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING ((SELECT auth.uid()) = id);

-- Courses Policies
CREATE POLICY "Users can view own or joined courses" ON public.courses
  FOR SELECT USING (
    ((SELECT auth.uid()) = user_id AND deleted_at IS NULL)
    OR
    public.is_course_member(id, (SELECT auth.uid()))
  );
CREATE POLICY "Anyone can lookup course by join code" ON public.courses
  FOR SELECT USING (
    join_code IS NOT NULL AND deleted_at IS NULL
  );
CREATE POLICY "Users can create courses" ON public.courses
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update own courses" ON public.courses
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can delete own courses" ON public.courses
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Topics Policies
CREATE POLICY "Users can view topics of own or joined courses" ON public.topics
  FOR SELECT USING (
    topics.deleted_at IS NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.courses
        WHERE courses.id = topics.course_id
        AND courses.user_id = (SELECT auth.uid())
        AND courses.deleted_at IS NULL
      )
      OR
      public.is_course_member(topics.course_id, (SELECT auth.uid()))
    )
  );
CREATE POLICY "Users can create topics in own courses" ON public.topics
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE public.courses.id = topics.course_id
      AND public.courses.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "Users can update topics in own courses" ON public.topics
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE public.courses.id = topics.course_id
      AND public.courses.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "Users can delete topics in own courses" ON public.topics
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE public.courses.id = topics.course_id
      AND public.courses.user_id = (SELECT auth.uid())
    )
  );

-- Mastery Events Policies
CREATE POLICY "Users can view own mastery events" ON public.mastery_events
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can create mastery events" ON public.mastery_events
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update own mastery events" ON public.mastery_events
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Anyone can view mastery cards by slug" ON public.mastery_events
  FOR SELECT USING (public_slug IS NOT NULL);

-- Peer Posts Policies
CREATE POLICY "Course owner or members can view posts" ON public.peer_posts
  FOR SELECT USING (
    public.is_course_member(peer_posts.course_id, (SELECT auth.uid()))
    OR
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = peer_posts.course_id
      AND courses.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "Users can create posts from own mastery" ON public.peer_posts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mastery_events
      WHERE public.mastery_events.id = peer_posts.mastery_event_id
      AND public.mastery_events.user_id = (SELECT auth.uid())
    )
  );

-- Course Members Policies
CREATE POLICY "Members can view course members" ON public.course_members
  FOR SELECT USING (
    (SELECT auth.uid()) = user_id
    OR
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = course_members.course_id
      AND courses.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "Users can join courses" ON public.course_members
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- Feed Reactions Policies
CREATE POLICY "Users can view feed reactions" ON public.feed_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.peer_posts p
      WHERE p.id = feed_reactions.post_id
      AND (
        public.is_course_member(p.course_id, (SELECT auth.uid()))
        OR
        EXISTS (
          SELECT 1 FROM public.courses c
          WHERE c.id = p.course_id
          AND c.user_id = (SELECT auth.uid())
        )
      )
    )
  );
CREATE POLICY "Users can insert own reactions" ON public.feed_reactions
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update own reactions" ON public.feed_reactions
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can delete own reactions" ON public.feed_reactions
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Reminder logs, rate limits, llm logs: service role only
CREATE POLICY "Service role only" ON public.reminder_logs FOR ALL USING (false);
CREATE POLICY "Service role only" ON public.rate_limits FOR ALL USING (false);
CREATE POLICY "Service role only" ON public.llm_logs FOR ALL USING (false);

-- ============================================================
-- 7. STORAGE BUCKETS AND POLICIES
-- ============================================================

-- Create the private bucket 'syllabi'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'syllabi',
  'syllabi',
  false,               -- private (no public access)
  10485760,            -- 10MB limit
  '{"application/pdf"}'::text[] -- Only PDF files
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Select policy: users can download their own syllabus
CREATE POLICY "Users can download own syllabus" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'syllabi'
    AND (select auth.uid()::text) = (storage.foldername(name))[1]
  );

-- Insert policy: users can upload their own syllabus
CREATE POLICY "Users can upload own syllabus" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'syllabi'
    AND (select auth.uid()::text) = (storage.foldername(name))[1]
    AND (LOWER(storage.extension(name)) = 'pdf')
  );

-- Update policy: users can update their own syllabus
CREATE POLICY "Users can update own syllabus" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'syllabi'
    AND (select auth.uid()::text) = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'syllabi'
    AND (select auth.uid()::text) = (storage.foldername(name))[1]
    AND (LOWER(storage.extension(name)) = 'pdf')
  );

-- Delete policy: users can delete their own syllabus
CREATE POLICY "Users can delete own syllabus" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'syllabi'
    AND (select auth.uid()::text) = (storage.foldername(name))[1]
  );

