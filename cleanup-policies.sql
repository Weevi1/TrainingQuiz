-- 28-Day Automatic Data Cleanup System for TrainingQuiz
-- This ensures compliance with data retention policies and keeps the database lean

-- Enable the pg_cron extension for scheduled tasks (requires superuser privileges)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cleanup function for completed quiz sessions and related data
CREATE OR REPLACE FUNCTION cleanup_old_sessions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete participant answers for sessions older than 28 days
  DELETE FROM participant_answers
  WHERE participant_id IN (
    SELECT p.id
    FROM participants p
    JOIN quiz_sessions qs ON p.session_id = qs.id
    WHERE qs.status = 'completed'
    AND qs.ended_at < NOW() - INTERVAL '28 days'
  );

  -- Delete participants for sessions older than 28 days
  DELETE FROM participants
  WHERE session_id IN (
    SELECT id
    FROM quiz_sessions
    WHERE status = 'completed'
    AND ended_at < NOW() - INTERVAL '28 days'
  );

  -- Delete completed quiz sessions older than 28 days
  -- Note: This preserves quiz templates and questions for reuse
  DELETE FROM quiz_sessions
  WHERE status = 'completed'
  AND ended_at < NOW() - INTERVAL '28 days';

  -- Log cleanup activity
  INSERT INTO cleanup_log (cleaned_at, description)
  VALUES (NOW(), 'Cleaned up quiz sessions and participant data older than 28 days');

  RAISE NOTICE 'Cleanup completed: Removed quiz sessions and participant data older than 28 days';
END;
$$;

-- Create cleanup log table to track cleanup activities
CREATE TABLE IF NOT EXISTS cleanup_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cleaned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  description TEXT NOT NULL
);

-- Create manual cleanup function for immediate use
CREATE OR REPLACE FUNCTION manual_cleanup_sessions(days_old INTEGER DEFAULT 28)
RETURNS TABLE(
  deleted_answers INTEGER,
  deleted_participants INTEGER,
  deleted_sessions INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  answer_count INTEGER := 0;
  participant_count INTEGER := 0;
  session_count INTEGER := 0;
BEGIN
  -- Count and delete participant answers
  SELECT COUNT(*) INTO answer_count
  FROM participant_answers
  WHERE participant_id IN (
    SELECT p.id
    FROM participants p
    JOIN quiz_sessions qs ON p.session_id = qs.id
    WHERE qs.status = 'completed'
    AND qs.ended_at < NOW() - (days_old || ' days')::INTERVAL
  );

  DELETE FROM participant_answers
  WHERE participant_id IN (
    SELECT p.id
    FROM participants p
    JOIN quiz_sessions qs ON p.session_id = qs.id
    WHERE qs.status = 'completed'
    AND qs.ended_at < NOW() - (days_old || ' days')::INTERVAL
  );

  -- Count and delete participants
  SELECT COUNT(*) INTO participant_count
  FROM participants
  WHERE session_id IN (
    SELECT id
    FROM quiz_sessions
    WHERE status = 'completed'
    AND ended_at < NOW() - (days_old || ' days')::INTERVAL
  );

  DELETE FROM participants
  WHERE session_id IN (
    SELECT id
    FROM quiz_sessions
    WHERE status = 'completed'
    AND ended_at < NOW() - (days_old || ' days')::INTERVAL
  );

  -- Count and delete sessions
  SELECT COUNT(*) INTO session_count
  FROM quiz_sessions
  WHERE status = 'completed'
  AND ended_at < NOW() - (days_old || ' days')::INTERVAL;

  DELETE FROM quiz_sessions
  WHERE status = 'completed'
  AND ended_at < NOW() - (days_old || ' days')::INTERVAL;

  -- Log the cleanup
  INSERT INTO cleanup_log (cleaned_at, description)
  VALUES (NOW(), format('Manual cleanup: %s answers, %s participants, %s sessions (older than %s days)',
    answer_count, participant_count, session_count, days_old));

  -- Return results
  RETURN QUERY SELECT answer_count, participant_count, session_count;
END;
$$;

-- Create function to view what would be cleaned up (dry run)
CREATE OR REPLACE FUNCTION preview_cleanup(days_old INTEGER DEFAULT 28)
RETURNS TABLE(
  sessions_to_delete INTEGER,
  participants_to_delete INTEGER,
  answers_to_delete INTEGER,
  oldest_session_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
DECLARE
  session_count INTEGER := 0;
  participant_count INTEGER := 0;
  answer_count INTEGER := 0;
  oldest_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Count sessions that would be deleted
  SELECT COUNT(*) INTO session_count
  FROM quiz_sessions
  WHERE status = 'completed'
  AND ended_at < NOW() - (days_old || ' days')::INTERVAL;

  -- Count participants that would be deleted
  SELECT COUNT(*) INTO participant_count
  FROM participants
  WHERE session_id IN (
    SELECT id
    FROM quiz_sessions
    WHERE status = 'completed'
    AND ended_at < NOW() - (days_old || ' days')::INTERVAL
  );

  -- Count answers that would be deleted
  SELECT COUNT(*) INTO answer_count
  FROM participant_answers
  WHERE participant_id IN (
    SELECT p.id
    FROM participants p
    JOIN quiz_sessions qs ON p.session_id = qs.id
    WHERE qs.status = 'completed'
    AND qs.ended_at < NOW() - (days_old || ' days')::INTERVAL
  );

  -- Find oldest session date
  SELECT MIN(ended_at) INTO oldest_date
  FROM quiz_sessions
  WHERE status = 'completed'
  AND ended_at < NOW() - (days_old || ' days')::INTERVAL;

  RETURN QUERY SELECT session_count, participant_count, answer_count, oldest_date;
END;
$$;

-- Example usage:
-- Manual cleanup: SELECT * FROM manual_cleanup_sessions(28);
-- Preview cleanup: SELECT * FROM preview_cleanup(28);
-- View cleanup history: SELECT * FROM cleanup_log ORDER BY cleaned_at DESC;

-- Note: To enable automatic scheduled cleanup using pg_cron (requires superuser):
-- SELECT cron.schedule('cleanup-old-sessions', '0 2 * * 0', 'SELECT cleanup_old_sessions();');
-- This would run every Sunday at 2 AM

-- Alternative: Create a simple scheduled function that can be called by an external cron job
CREATE OR REPLACE FUNCTION scheduled_cleanup()
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT row_to_json(t) INTO result
  FROM (
    SELECT * FROM manual_cleanup_sessions(28)
  ) t;

  RETURN result;
END;
$$;