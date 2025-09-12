-- Complete fix for Supabase permissions
-- Run this in Supabase SQL Editor

-- First, check and insert the dummy trainer
INSERT INTO trainers (id, email, name) 
VALUES ('00000000-0000-0000-0000-000000000001', 'admin@test.com', 'Test Admin')
ON CONFLICT (id) DO NOTHING;

-- Completely disable RLS for testing (this will make it work immediately)
ALTER TABLE trainers DISABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes DISABLE ROW LEVEL SECURITY;
ALTER TABLE questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE participant_answers DISABLE ROW LEVEL SECURITY;

-- Alternative: If you want to keep RLS enabled, drop ALL existing policies first
DROP POLICY IF EXISTS "Trainers can view own data" ON trainers;
DROP POLICY IF EXISTS "Trainers can manage own quizzes" ON quizzes;
DROP POLICY IF EXISTS "Trainers can manage questions for own quizzes" ON questions;
DROP POLICY IF EXISTS "Trainers can manage own sessions" ON quiz_sessions;
DROP POLICY IF EXISTS "Anyone can view active sessions by code" ON quiz_sessions;
DROP POLICY IF EXISTS "Anyone can join sessions" ON participants;
DROP POLICY IF EXISTS "Participants can view session data" ON participants;
DROP POLICY IF EXISTS "Participants can submit answers" ON participant_answers;
DROP POLICY IF EXISTS "Trainers can view all answers for their sessions" ON participant_answers;
DROP POLICY IF EXISTS "Allow all trainer access" ON trainers;
DROP POLICY IF EXISTS "Allow all quiz access" ON quizzes;
DROP POLICY IF EXISTS "Allow all question access" ON questions;
DROP POLICY IF EXISTS "Allow all session access" ON quiz_sessions;
DROP POLICY IF EXISTS "Allow all answer access" ON participant_answers;

-- Then re-enable RLS and create simple permissive policies
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_answers ENABLE ROW LEVEL SECURITY;

-- Create completely open policies for testing
CREATE POLICY "Open access" ON trainers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Open access" ON quizzes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Open access" ON questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Open access" ON quiz_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Open access" ON participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Open access" ON participant_answers FOR ALL USING (true) WITH CHECK (true);