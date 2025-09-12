-- Development setup script for TrainingQuiz
-- Run this in Supabase SQL editor after running the main schema

-- First, temporarily disable RLS for development
ALTER TABLE trainers DISABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes DISABLE ROW LEVEL SECURITY;
ALTER TABLE questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE participant_answers DISABLE ROW LEVEL SECURITY;

-- Create a dummy trainer for development
INSERT INTO trainers (id, email, name) VALUES 
('00000000-0000-0000-0000-000000000001', 'admin@trainingquiz.dev', 'Demo Admin')
ON CONFLICT (id) DO NOTHING;

-- Optional: Create some sample data for testing
-- Uncomment these lines if you want sample quizzes

-- INSERT INTO quizzes (trainer_id, title, description, time_limit) VALUES 
-- ('00000000-0000-0000-0000-000000000001', 'Sample React Quiz', 'Test your React knowledge', 300);

-- You can re-enable RLS later for production:
-- ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
-- etc...