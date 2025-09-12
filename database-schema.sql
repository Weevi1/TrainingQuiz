-- Training Quiz Database Schema

-- Trainers/Admins table
CREATE TABLE trainers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quizzes table
CREATE TABLE quizzes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id UUID REFERENCES trainers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  time_limit INTEGER NOT NULL DEFAULT 600, -- seconds
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Questions table
CREATE TABLE questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice', -- multiple_choice, true_false
  options JSONB, -- array of options for multiple choice
  correct_answer TEXT NOT NULL,
  points INTEGER DEFAULT 1,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quiz sessions (active quiz instances)
CREATE TABLE quiz_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  trainer_id UUID REFERENCES trainers(id) ON DELETE CASCADE,
  session_code TEXT UNIQUE NOT NULL, -- short code for QR
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting, active, completed
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Participants table
CREATE TABLE participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Participant answers
CREATE TABLE participant_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  time_taken INTEGER -- seconds to answer this question
);

-- Indexes for performance
CREATE INDEX idx_quizzes_trainer_id ON quizzes(trainer_id);
CREATE INDEX idx_questions_quiz_id ON questions(quiz_id);
CREATE INDEX idx_quiz_sessions_trainer_id ON quiz_sessions(trainer_id);
CREATE INDEX idx_participants_session_id ON participants(session_id);
CREATE INDEX idx_participant_answers_participant_id ON participant_answers(participant_id);
CREATE INDEX idx_participant_answers_question_id ON participant_answers(question_id);

-- Row Level Security policies
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_answers ENABLE ROW LEVEL SECURITY;

-- Policies for trainers
CREATE POLICY "Trainers can view own data" ON trainers FOR ALL USING (auth.uid() = id);

-- Policies for quizzes
CREATE POLICY "Trainers can manage own quizzes" ON quizzes FOR ALL USING (trainer_id = auth.uid());

-- Policies for questions
CREATE POLICY "Trainers can manage questions for own quizzes" ON questions FOR ALL 
USING (quiz_id IN (SELECT id FROM quizzes WHERE trainer_id = auth.uid()));

-- Policies for quiz sessions
CREATE POLICY "Trainers can manage own sessions" ON quiz_sessions FOR ALL USING (trainer_id = auth.uid());
CREATE POLICY "Anyone can view active sessions by code" ON quiz_sessions FOR SELECT USING (status = 'active');

-- Policies for participants
CREATE POLICY "Anyone can join sessions" ON participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Participants can view session data" ON participants FOR SELECT USING (true);

-- Policies for answers
CREATE POLICY "Participants can submit answers" ON participant_answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Trainers can view all answers for their sessions" ON participant_answers FOR SELECT 
USING (question_id IN (
  SELECT q.id FROM questions q 
  JOIN quizzes qz ON q.quiz_id = qz.id 
  WHERE qz.trainer_id = auth.uid()
));