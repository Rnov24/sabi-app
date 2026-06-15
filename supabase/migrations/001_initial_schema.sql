-- ============================================================
-- SABI — Initial Schema Migration
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

-- Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  university TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Courses: syllabus-based and free explore
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
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
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  parent_topic TEXT,
  difficulty TEXT CHECK (difficulty IN ('basic', 'intermediate', 'advanced')),
  display_order INT DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Mastery events
CREATE TABLE mastery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE NOT NULL,
  mastery_card_text TEXT NOT NULL,
  public_slug TEXT UNIQUE,
  rounds_taken INT NOT NULL DEFAULT 1,
  ease_factor FLOAT NOT NULL DEFAULT 2.5,
  interval_days INT NOT NULL DEFAULT 1,
  next_review_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Peer feed posts (post-MVP but create table now)
CREATE TABLE peer_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mastery_event_id UUID REFERENCES mastery_events(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  is_visible BOOLEAN DEFAULT TRUE NOT NULL,
  helpful_count INT DEFAULT 0 NOT NULL,
  unclear_count INT DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Course memberships (post-MVP but create table now)
CREATE TABLE course_members (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'student' CHECK (role IN ('student', 'lecturer')),
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, course_id)
);

-- Reminder logs
CREATE TABLE reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  total_due INT NOT NULL DEFAULT 0,
  emails_sent INT NOT NULL DEFAULT 0,
  errors INT NOT NULL DEFAULT 0
);

-- Rate limits
CREATE TABLE rate_limits (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, endpoint, date)
);

-- LLM usage logs
CREATE TABLE llm_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  route TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INT,
  output_tokens INT,
  duration_ms INT,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_courses_user_id ON courses(user_id);
CREATE INDEX idx_topics_course_id ON topics(course_id);
CREATE INDEX idx_mastery_events_user_id ON mastery_events(user_id);
CREATE INDEX idx_mastery_events_next_review ON mastery_events(next_review_date);
CREATE INDEX idx_mastery_events_slug ON mastery_events(public_slug);
CREATE INDEX idx_mastery_events_topic_id ON mastery_events(topic_id);
CREATE INDEX idx_llm_logs_created ON llm_logs(created_at);

-- ============================================================
-- AUTO-CREATE PROFILE TRIGGER
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
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- RATE LIMIT HELPER RPC
-- ============================================================

CREATE OR REPLACE FUNCTION check_and_increment_rate_limit(
  p_user_id UUID,
  p_endpoint TEXT,
  p_max_per_day INT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO rate_limits (user_id, endpoint, date, count)
  VALUES (p_user_id, p_endpoint, CURRENT_DATE, 1)
  ON CONFLICT (user_id, endpoint, date)
  DO UPDATE SET count = rate_limits.count + 1
  RETURNING count INTO v_count;

  RETURN v_count <= p_max_per_day;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE mastery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE peer_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read and update their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Courses: all ops restricted to owner
CREATE POLICY "Users can view own courses" ON courses
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "Users can create courses" ON courses
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own courses" ON courses
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own courses" ON courses
  FOR DELETE USING (auth.uid() = user_id);

-- Topics: access via course ownership
CREATE POLICY "Users can view topics of own courses" ON topics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = topics.course_id
      AND courses.user_id = auth.uid()
      AND courses.deleted_at IS NULL
    )
    AND topics.deleted_at IS NULL
  );
CREATE POLICY "Users can create topics in own courses" ON topics
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = topics.course_id
      AND courses.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update topics in own courses" ON topics
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = topics.course_id
      AND courses.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete topics in own courses" ON topics
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = topics.course_id
      AND courses.user_id = auth.uid()
    )
  );

-- Mastery events: restricted to owner
CREATE POLICY "Users can view own mastery events" ON mastery_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create mastery events" ON mastery_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own mastery events" ON mastery_events
  FOR UPDATE USING (auth.uid() = user_id);

-- Public read for mastery cards via slug (for sharing)
CREATE POLICY "Anyone can view mastery cards by slug" ON mastery_events
  FOR SELECT USING (public_slug IS NOT NULL);

-- Peer posts: visible to course members
CREATE POLICY "Course members can view posts" ON peer_posts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM course_members
      WHERE course_members.course_id = peer_posts.course_id
      AND course_members.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can create posts from own mastery" ON peer_posts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM mastery_events
      WHERE mastery_events.id = peer_posts.mastery_event_id
      AND mastery_events.user_id = auth.uid()
    )
  );

-- Course members: users can join and view co-members
CREATE POLICY "Members can view course members" ON course_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM course_members cm
      WHERE cm.course_id = course_members.course_id
      AND cm.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can join courses" ON course_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Reminder logs, rate limits, llm logs: service role only (no client access)
CREATE POLICY "Service role only" ON reminder_logs
  FOR ALL USING (false);
CREATE POLICY "Service role only" ON rate_limits
  FOR ALL USING (false);
CREATE POLICY "Service role only" ON llm_logs
  FOR ALL USING (false);
