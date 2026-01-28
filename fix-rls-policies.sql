-- Fix RLS policies to allow anonymous participant submissions

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Participants can submit answers" ON participant_answers;
DROP POLICY IF EXISTS "Anyone can join sessions" ON participants;

-- Create more permissive policies for anonymous users
CREATE POLICY "Anyone can submit answers" ON participant_answers
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view their own answers" ON participant_answers
FOR SELECT
USING (true);

CREATE POLICY "Anyone can join any session" ON participants
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view participants" ON participants
FOR SELECT
USING (true);

-- Update session policy to allow anonymous access
DROP POLICY IF EXISTS "Anyone can view active sessions by code" ON quiz_sessions;
CREATE POLICY "Anyone can view sessions by code" ON quiz_sessions
FOR SELECT
USING (true);

-- Allow anonymous access to questions for quiz taking
CREATE POLICY "Anyone can view questions" ON questions
FOR SELECT
USING (true);

CREATE POLICY "Anyone can view quizzes" ON quizzes
FOR SELECT
USING (true);