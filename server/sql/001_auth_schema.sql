CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY,
    name TEXT NOT NULL,
    username VARCHAR(64) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'technician',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT users_role_check CHECK (role IN ('admin', 'technician'))
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at
ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS os_records (
    os_id VARCHAR(120) PRIMARY KEY,
    payload JSON NOT NULL,
    submitted_by CHAR(36) NULL,
    last_operation VARCHAR(20) NOT NULL,
    deleted_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_os_records_submitted_by FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_os_records_updated_at
ON os_records(updated_at);

CREATE INDEX IF NOT EXISTS idx_os_records_deleted_updated
ON os_records(deleted_at, updated_at);

CREATE INDEX IF NOT EXISTS idx_os_records_submitted_by
ON os_records(submitted_by);

UPDATE users
SET role = 'technician'
WHERE role NOT IN ('admin', 'technician');
