-- Security hardening: persistent API rate-limit counters.
-- Safe to apply repeatedly.

CREATE TABLE IF NOT EXISTS api_rate_limits (
  key_hash CHAR(64) PRIMARY KEY,
  action VARCHAR(64) NOT NULL,
  attempts INT UNSIGNED NOT NULL DEFAULT 1,
  window_started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_api_rate_limits_expires_at (expires_at),
  INDEX idx_api_rate_limits_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
