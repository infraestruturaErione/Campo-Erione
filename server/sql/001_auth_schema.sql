CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'technician',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at
ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS os_records (
    os_id TEXT PRIMARY KEY,
    payload JSONB NOT NULL,
    submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    last_operation TEXT NOT NULL,
    deleted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_os_records_updated_at
ON os_records(updated_at DESC);

UPDATE users SET role = 'technician' WHERE role NOT IN ('admin', 'technician');

ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'technician'));

CREATE INDEX IF NOT EXISTS idx_os_records_deleted_updated
ON os_records(deleted_at, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_os_records_submitted_by
ON os_records(submitted_by);
