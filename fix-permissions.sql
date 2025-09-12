-- Fix TrainingQuiz permissions for testing without authentication
-- This allows the app to work with dummy trainer ID for testing purposes

-- First, insert the dummy trainer if it doesn't exist
INSERT INTO trainers (id, email, name) 
VALUES ('00000000-0000-0000-0000-000000000001', 'admin@test.com', 'Test Admin')
ON CONFLICT (id) DO NOTHING;

-- Temporarily modify policies to allow access without authentication for testing
-- Replace the restrictive policies with more permissive ones

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Trainers can view own data" ON trainers;
DROP POLICY IF EXISTS "Trainers can manage own quizzes" ON quizzes;
DROP POLICY IF EXISTS "Trainers can manage questions for own quizzes" ON questions;
DROP POLICY IF EXISTS "Trainers can manage own sessions" ON quiz_sessions;

-- Create permissive policies for testing
CREATE POLICY "Allow all trainer access" ON trainers FOR ALL USING (true);
CREATE POLICY "Allow all quiz access" ON quizzes FOR ALL USING (true);
CREATE POLICY "Allow all question access" ON questions FOR ALL USING (true);
CREATE POLICY "Allow all session access" ON quiz_sessions FOR ALL USING (true);

-- Keep existing participant policies (they're already permissive)
-- "Anyone can join sessions" ON participants
-- "Participants can view session data" ON participants
-- "Anyone can view active sessions by code" ON quiz_sessions (SELECT)
-- "Participants can submit answers" ON participant_answers
-- Trainers can view answers - update this one too
DROP POLICY IF EXISTS "Trainers can view all answers for their sessions" ON participant_answers;
CREATE POLICY "Allow all answer access" ON participant_answers FOR ALL USING (true);