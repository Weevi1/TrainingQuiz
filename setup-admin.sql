-- Training Quiz Admin Setup
-- Run this in Supabase SQL editor after running the main schema

-- Temporarily disable RLS for development (can re-enable later with proper auth)
ALTER TABLE trainers DISABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes DISABLE ROW LEVEL SECURITY;
ALTER TABLE questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE participant_answers DISABLE ROW LEVEL SECURITY;

-- Create Riaan Potas as the administrator
INSERT INTO trainers (id, email, name) VALUES 
('00000000-0000-0000-0000-000000000001', 'riaan.potas@gmail.com', 'Riaan Potas')
ON CONFLICT (id) DO NOTHING;

-- Verify the admin was created
SELECT * FROM trainers WHERE email = 'riaan.potas@gmail.com';