-- ============================================================
-- Migration 004: Fix RLS Infinite Recursion using Security Definer
-- ============================================================

-- 1. Create security definer function to check course membership without RLS cycles
CREATE OR REPLACE FUNCTION public.is_course_member(p_course_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.course_members
    WHERE course_id = p_course_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Update courses SELECT policy to use the function
DROP POLICY IF EXISTS "Users can view own or joined courses" ON public.courses;
CREATE POLICY "Users can view own or joined courses" ON public.courses
  FOR SELECT USING (
    (auth.uid() = user_id AND deleted_at IS NULL)
    OR
    public.is_course_member(id, auth.uid())
  );

-- 3. Update topics SELECT policy to use the function
DROP POLICY IF EXISTS "Users can view topics of own or joined courses" ON public.topics;
CREATE POLICY "Users can view topics of own or joined courses" ON public.topics
  FOR SELECT USING (
    topics.deleted_at IS NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.courses
        WHERE courses.id = topics.course_id
        AND courses.user_id = auth.uid()
        AND courses.deleted_at IS NULL
      )
      OR
      public.is_course_member(topics.course_id, auth.uid())
    )
  );

-- 4. Update peer_posts SELECT policy to use the function
DROP POLICY IF EXISTS "Course owner or members can view posts" ON public.peer_posts;
CREATE POLICY "Course owner or members can view posts" ON public.peer_posts
  FOR SELECT USING (
    public.is_course_member(peer_posts.course_id, auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = peer_posts.course_id
      AND courses.user_id = auth.uid()
    )
  );

-- 5. Update course_members SELECT policy to be non-recursive (only owner or the member themselves)
DROP POLICY IF EXISTS "Members can view course members" ON public.course_members;
CREATE POLICY "Members can view course members" ON public.course_members
  FOR SELECT USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = course_members.course_id
      AND courses.user_id = auth.uid()
    )
  );

-- 6. Update feed_reactions SELECT policy to use the function
DROP POLICY IF EXISTS "Users can view feed reactions" ON public.feed_reactions;
CREATE POLICY "Users can view feed reactions" ON public.feed_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.peer_posts p
      WHERE p.id = feed_reactions.post_id
      AND (
        public.is_course_member(p.course_id, auth.uid())
        OR
        EXISTS (
          SELECT 1 FROM public.courses c
          WHERE c.id = p.course_id
          AND c.user_id = auth.uid()
        )
      )
    )
  );
