-- PostgreSQL Schema for Ticketing Queue System
-- Requirements: 11.2, 11.3

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create tickets table
CREATE TABLE IF NOT EXISTS tickets (
  ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  event_id VARCHAR(100),  -- NULL for simple mode
  issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active, used, expired, cancelled
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_status CHECK (status IN ('active', 'used', 'expired', 'cancelled'))
);

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create indexes for sessions table
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Create indexes for tickets table
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_expires_at ON tickets(expires_at);
CREATE INDEX IF NOT EXISTS idx_tickets_event_id ON tickets(event_id);

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  event_id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  venue VARCHAR(255),
  event_date TIMESTAMP NOT NULL,
  total_seats INTEGER NOT NULL DEFAULT 100,
  available_seats INTEGER NOT NULL DEFAULT 100,
  price INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_event_status CHECK (status IN ('active', 'sold_out', 'cancelled', 'completed'))
);

-- Create seats table
CREATE TABLE IF NOT EXISTS seats (
  seat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(100) NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  section VARCHAR(50) NOT NULL,
  row_number VARCHAR(10) NOT NULL,
  seat_number INTEGER NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'available',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_seat_status CHECK (status IN ('available', 'reserved', 'sold')),
  UNIQUE(event_id, section, row_number, seat_number)
);

-- Create reservations table (티켓 예약/구매 내역)
CREATE TABLE IF NOT EXISTS reservations (
  reservation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  event_id VARCHAR(100) NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  seat_id UUID REFERENCES seats(seat_id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES tickets(ticket_id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  total_price INTEGER NOT NULL DEFAULT 0,
  reserved_at TIMESTAMP NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_reservation_status CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired'))
);

-- Create indexes for events table
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);

-- Create indexes for seats table
CREATE INDEX IF NOT EXISTS idx_seats_event_id ON seats(event_id);
CREATE INDEX IF NOT EXISTS idx_seats_status ON seats(status);

-- Create indexes for reservations table
CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_event_id ON reservations(event_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- Create triggers for updated_at on new tables
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_seats_updated_at
  BEFORE UPDATE ON seats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Initial Data: Events
-- =====================================================
INSERT INTO events (event_id, name, description, venue, event_date, total_seats, available_seats, price, status)
VALUES 
  ('bts-concert', 'BTS World Tour Seoul Concert', 'BTS 월드투어 서울 콘서트 - 잠실 주경기장', '잠실 주경기장', '2026-06-15 19:00:00', 50, 50, 150000, 'active'),
  ('lim-younghung', 'Lim Young-woong National Tour Concert', '임영웅 전국투어 콘서트 - 고척스카이돔', '고척스카이돔', '2026-07-20 18:00:00', 50, 50, 120000, 'active')
ON CONFLICT (event_id) DO NOTHING;

-- =====================================================
-- Initial Data: Seats for BTS Concert
-- =====================================================
-- VIP Section (10 seats)
INSERT INTO seats (event_id, section, row_number, seat_number, price, status)
SELECT 'bts-concert', 'VIP', 'A', generate_series(1, 10), 300000, 'available'
ON CONFLICT DO NOTHING;

-- R Section (20 seats)
INSERT INTO seats (event_id, section, row_number, seat_number, price, status)
SELECT 'bts-concert', 'R', 'B', generate_series(1, 10), 200000, 'available'
ON CONFLICT DO NOTHING;

INSERT INTO seats (event_id, section, row_number, seat_number, price, status)
SELECT 'bts-concert', 'R', 'C', generate_series(1, 10), 200000, 'available'
ON CONFLICT DO NOTHING;

-- S Section (20 seats)
INSERT INTO seats (event_id, section, row_number, seat_number, price, status)
SELECT 'bts-concert', 'S', 'D', generate_series(1, 10), 150000, 'available'
ON CONFLICT DO NOTHING;

INSERT INTO seats (event_id, section, row_number, seat_number, price, status)
SELECT 'bts-concert', 'S', 'E', generate_series(1, 10), 150000, 'available'
ON CONFLICT DO NOTHING;

-- =====================================================
-- Initial Data: Seats for Lim Young-woong Concert
-- =====================================================
-- VIP Section (10 seats)
INSERT INTO seats (event_id, section, row_number, seat_number, price, status)
SELECT 'lim-younghung', 'VIP', 'A', generate_series(1, 10), 250000, 'available'
ON CONFLICT DO NOTHING;

-- R Section (20 seats)
INSERT INTO seats (event_id, section, row_number, seat_number, price, status)
SELECT 'lim-younghung', 'R', 'B', generate_series(1, 10), 180000, 'available'
ON CONFLICT DO NOTHING;

INSERT INTO seats (event_id, section, row_number, seat_number, price, status)
SELECT 'lim-younghung', 'R', 'C', generate_series(1, 10), 180000, 'available'
ON CONFLICT DO NOTHING;

-- S Section (20 seats)
INSERT INTO seats (event_id, section, row_number, seat_number, price, status)
SELECT 'lim-younghung', 'S', 'D', generate_series(1, 10), 120000, 'available'
ON CONFLICT DO NOTHING;

INSERT INTO seats (event_id, section, row_number, seat_number, price, status)
SELECT 'lim-younghung', 'S', 'E', generate_series(1, 10), 120000, 'available'
ON CONFLICT DO NOTHING;

-- =====================================================
-- Queue Config Initial Data (Redis에서 로드할 기본값)
-- =====================================================
-- Note: 이 데이터는 Queue Service 시작 시 Redis에 로드됩니다
