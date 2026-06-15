-- ============================================================
-- Migration 003: Fix RLS policies for member + owner access
-- 
-- Problems fixed:
-- 1. courses SELECT only allowed owner → members blocked
-- 2. topics SELECT only allowed owner → members blocked  
-- 3. peer_posts SELECT only checked course_members → owner blocked
-- 4. feed_reactions SELECT only checked course_members → owner blocked
-- ============================================================

-- 1. FIX COURSES SELECT: allow owner OR member
DROP POLICY IF EXISTS "Users can view own courses" ON public.courses;

CREATE POLICY "Users can view own or joined courses" ON public.courses
  FOR SELECT USING (
    (auth.uid() = user_id AND deleted_at IS NULL)
    OR
    EXISTS (
      SELECT 1 FROM public.course_members
      WHERE course_members.course_id = courses.id
      AND course_members.user_id = auth.uid()
    )
  );

-- Also allow members to see course even if they need join_code lookup
-- (for the join flow — need to read course by join_code before joining)
DROP POLICY IF EXISTS "Anyone can lookup course by join code" ON public.courses;

CREATE POLICY "Anyone can lookup course by join code" ON public.courses
  FOR SELECT USING (
    join_code IS NOT NULL AND deleted_at IS NULL
  );

-- 2. FIX TOPICS SELECT: allow owner OR member
DROP POLICY IF EXISTS "Users can view topics of own courses" ON public.topics;

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
      EXISTS (
        SELECT 1 FROM public.course_members
        WHERE course_members.course_id = topics.course_id
        AND course_members.user_id = auth.uid()
      )
    )
  );

-- 3. FIX PEER_POSTS SELECT: allow member OR course owner
DROP POLICY IF EXISTS "Course members can view posts" ON public.peer_posts;

CREATE POLICY "Course owner or members can view posts" ON public.peer_posts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.course_members
      WHERE course_members.course_id = peer_posts.course_id
      AND course_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = peer_posts.course_id
      AND courses.user_id = auth.uid()
    )
  );

-- 4. FIX FEED_REACTIONS SELECT: allow member OR course owner
DROP POLICY IF EXISTS "Users can view feed reactions" ON public.feed_reactions;

CREATE POLICY "Users can view feed reactions" ON public.feed_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.peer_posts p
      WHERE p.id = feed_reactions.post_id
      AND (
        EXISTS (
          SELECT 1 FROM public.course_members cm
          WHERE cm.course_id = p.course_id
          AND cm.user_id = auth.uid()
        )
        OR
        EXISTS (
          SELECT 1 FROM public.courses c
          WHERE c.id = p.course_id
          AND c.user_id = auth.uid()
        )
      )
    )
  );
