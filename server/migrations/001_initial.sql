CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;

CREATE TABLE members (
  id uuid PRIMARY KEY,
  name varchar(60) NOT NULL,
  email varchar(120) NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  suspended boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (email = lower(email))
);
CREATE UNIQUE INDEX members_active_email ON members (email) WHERE deleted_at IS NULL;

CREATE TABLE sessions (
  token_hash char(64) PRIMARY KEY,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  csrf_token char(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_member ON sessions(member_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);

CREATE TABLE cars (
  id text PRIMARY KEY,
  name varchar(60) NOT NULL,
  category text NOT NULL CHECK (category IN ('Sedan', 'SUV', 'Sport', 'Compact')),
  price integer NOT NULL CHECK (price BETWEEN 1 AND 100000),
  seats integer NOT NULL CHECK (seats BETWEEN 1 AND 9),
  transmission text NOT NULL CHECK (transmission IN ('Automatic', 'Manual')),
  fuel text NOT NULL CHECK (fuel IN ('Petrol', 'Diesel', 'Electric', 'Hybrid')),
  location text NOT NULL CHECK (location IN ('Tunis', 'La Marsa', 'Sousse')),
  image text NOT NULL,
  badge varchar(80) NOT NULL DEFAULT 'New to the collection',
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rentals (
  id uuid PRIMARY KEY,
  reference varchar(24) NOT NULL UNIQUE,
  car_id text NOT NULL REFERENCES cars(id),
  member_id uuid NOT NULL REFERENCES members(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  daily_rate integer NOT NULL CHECK (daily_rate BETWEEN 1 AND 100000),
  total integer GENERATED ALWAYS AS (daily_rate * (end_date - start_date)) STORED,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  car_name varchar(60) NOT NULL,
  car_image text NOT NULL,
  member_name varchar(60) NOT NULL,
  member_email varchar(120) NOT NULL,
  location text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  CHECK (end_date > start_date AND end_date - start_date <= 365),
  -- The database rejects overlapping bookings, including concurrent requests.
  CONSTRAINT no_overlapping_rentals EXCLUDE USING gist (
    car_id WITH =,
    daterange(start_date, end_date, '[)') WITH &&
  ) WHERE (status = 'confirmed')
);
CREATE INDEX rentals_member ON rentals(member_id, created_at DESC);
