-- ============================================================
-- SABI — Feed Reactions Table Migration
-- ============================================================

CREATE TABLE feed_reactions (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES peer_posts(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('helpful', 'unclear')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, post_id)
);

-- Enable RLS
ALTER TABLE feed_reactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view feed reactions" ON feed_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM peer_posts p
      JOIN course_members cm ON p.course_id = cm.course_id
      WHERE p.id = feed_reactions.post_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own reactions" ON feed_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reactions" ON feed_reactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reactions" ON feed_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- Index for speed
CREATE INDEX idx_feed_reactions_post_id ON feed_reactions(post_id);
