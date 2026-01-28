-- Enable Real-time for TrainingQuiz Tables
-- Run this in Supabase SQL Editor to fix real-time subscriptions

-- Enable real-time for the tables we need to monitor
ALTER publication supabase_realtime ADD TABLE participants;
ALTER publication supabase_realtime ADD TABLE participant_answers;
ALTER publication supabase_realtime ADD TABLE quiz_sessions;

-- Create function to calculate participant completion status
CREATE OR REPLACE FUNCTION get_participant_completion_status(p_session_id UUID)
RETURNS TABLE (
  participant_id UUID,
  participant_name TEXT,
  total_answers BIGINT,
  total_questions BIGINT,
  completed BOOLEAN,
  score INTEGER,
  avg_time NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as participant_id,
    p.name as participant_name,
    COUNT(pa.id) as total_answers,
    (SELECT COUNT(*) FROM questions q
     JOIN quiz_sessions qs ON q.quiz_id = qs.quiz_id
     WHERE qs.id = p_session_id) as total_questions,
    COUNT(pa.id) >= (SELECT COUNT(*) FROM questions q
                     JOIN quiz_sessions qs ON q.quiz_id = qs.quiz_id
                     WHERE qs.id = p_session_id) as completed,
    COALESCE(ROUND(AVG(CASE WHEN pa.is_correct THEN 100 ELSE 0 END)), 0)::INTEGER as score,
    COALESCE(ROUND(AVG(pa.time_taken)), 0) as avg_time
  FROM participants p
  LEFT JOIN participant_answers pa ON p.id = pa.participant_id
  WHERE p.session_id = p_session_id
  GROUP BY p.id, p.name
  ORDER BY p.joined_at;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions for real-time access
GRANT SELECT ON participants TO anon;
GRANT SELECT ON participant_answers TO anon;
GRANT SELECT ON quiz_sessions TO anon;

-- Ensure RLS policies allow real-time subscriptions for anonymous users
DROP POLICY IF EXISTS "Real-time participants access" ON participants;
CREATE POLICY "Real-time participants access" ON participants
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Real-time answers access" ON participant_answers;
CREATE POLICY "Real-time answers access" ON participant_answers
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Real-time sessions access" ON quiz_sessions;
CREATE POLICY "Real-time sessions access" ON quiz_sessions
FOR SELECT USING (true);