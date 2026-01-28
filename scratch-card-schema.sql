-- Scratch Card Giveaway System Database Schema

-- Scratch card sessions
CREATE TABLE scratch_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  session_code VARCHAR(10) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'setup', -- setup, waiting, active, completed
  total_cards INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  ended_at TIMESTAMP
);

-- Prize templates for each session
CREATE TABLE scratch_prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES scratch_sessions(id) ON DELETE CASCADE,
  prize_name VARCHAR(255) NOT NULL,
  prize_value VARCHAR(100), -- e.g., "R500", "Coffee Voucher", "10% Discount"
  prize_description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Participants in scratch card sessions
CREATE TABLE scratch_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES scratch_sessions(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Individual scratch cards assigned to participants
CREATE TABLE scratch_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES scratch_sessions(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES scratch_participants(id) ON DELETE CASCADE,
  prize_id UUID REFERENCES scratch_prizes(id) ON DELETE SET NULL, -- NULL means no prize
  is_scratched BOOLEAN DEFAULT FALSE,
  scratched_at TIMESTAMP,
  card_number INTEGER NOT NULL, -- Display number for the card
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, participant_id), -- One card per participant per session
  UNIQUE(session_id, card_number) -- Unique card numbers within session
);

-- Enable RLS (Row Level Security)
ALTER TABLE scratch_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scratch_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scratch_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE scratch_cards ENABLE ROW LEVEL SECURITY;

-- Policies for public access (since this is a demo app)
CREATE POLICY "Public access to scratch_sessions" ON scratch_sessions FOR ALL USING (true);
CREATE POLICY "Public access to scratch_prizes" ON scratch_prizes FOR ALL USING (true);
CREATE POLICY "Public access to scratch_participants" ON scratch_participants FOR ALL USING (true);
CREATE POLICY "Public access to scratch_cards" ON scratch_cards FOR ALL USING (true);

-- Indexes for performance
CREATE INDEX idx_scratch_sessions_code ON scratch_sessions(session_code);
CREATE INDEX idx_scratch_sessions_status ON scratch_sessions(status);
CREATE INDEX idx_scratch_participants_session ON scratch_participants(session_id);
CREATE INDEX idx_scratch_cards_session ON scratch_cards(session_id);
CREATE INDEX idx_scratch_cards_participant ON scratch_cards(participant_id);
CREATE INDEX idx_scratch_cards_scratched ON scratch_cards(is_scratched);

-- Functions to generate session codes
CREATE OR REPLACE FUNCTION generate_scratch_session_code()
RETURNS VARCHAR(10) AS $$
DECLARE
  code VARCHAR(10);
  exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a 6-character code with numbers and uppercase letters
    code := upper(substring(md5(random()::text) from 1 for 6));

    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM scratch_sessions WHERE session_code = code) INTO exists;

    IF NOT exists THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;