-- AWS Knowledge Hub Database Schema

-- User sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    metadata TEXT -- JSON string for additional session data
);

-- Question-answer conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    aws_services TEXT, -- JSON array of identified AWS services
    search_topics TEXT, -- JSON array of MCP search topics used
    sources TEXT, -- JSON array of documentation sources
    response_time INTEGER, -- Response time in milliseconds
    confidence_score REAL DEFAULT 0.0, -- Answer confidence (0.0 to 1.0)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Cached documentation content table
CREATE TABLE IF NOT EXISTS documentation_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE NOT NULL,
    title TEXT,
    content TEXT,
    topic TEXT, -- MCP search topic (reference_documentation, troubleshooting, etc.)
    relevance_score REAL DEFAULT 0.0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    access_count INTEGER DEFAULT 0 -- Track cache hit frequency
);

-- Search analytics table
CREATE TABLE IF NOT EXISTS search_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    question TEXT,
    question_type TEXT, -- technical, conceptual, troubleshooting, howto
    aws_services TEXT, -- JSON array of identified services
    search_topics TEXT, -- JSON array of MCP topics searched
    response_time INTEGER, -- Total response time in milliseconds
    success BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    user_agent TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

-- AWS services reference table (for normalization and suggestions)
CREATE TABLE IF NOT EXISTS aws_services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_name TEXT UNIQUE NOT NULL, -- Full service name (e.g., "Amazon S3")
    service_code TEXT UNIQUE NOT NULL, -- Short code (e.g., "s3")
    category TEXT, -- Service category (compute, storage, database, etc.)
    description TEXT,
    documentation_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Question suggestions table (for auto-complete)
CREATE TABLE IF NOT EXISTS question_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    suggestion_text TEXT NOT NULL,
    category TEXT, -- service-specific, general, troubleshooting
    aws_service TEXT, -- Related AWS service
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);

CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_aws_services ON conversations(aws_services);

CREATE INDEX IF NOT EXISTS idx_documentation_cache_url ON documentation_cache(url);
CREATE INDEX IF NOT EXISTS idx_documentation_cache_topic ON documentation_cache(topic);
CREATE INDEX IF NOT EXISTS idx_documentation_cache_expires_at ON documentation_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_documentation_cache_access_count ON documentation_cache(access_count);

CREATE INDEX IF NOT EXISTS idx_search_analytics_session_id ON search_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_created_at ON search_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_search_analytics_question_type ON search_analytics(question_type);
CREATE INDEX IF NOT EXISTS idx_search_analytics_success ON search_analytics(success);

CREATE INDEX IF NOT EXISTS idx_aws_services_service_code ON aws_services(service_code);
CREATE INDEX IF NOT EXISTS idx_aws_services_category ON aws_services(category);
CREATE INDEX IF NOT EXISTS idx_aws_services_is_active ON aws_services(is_active);

CREATE INDEX IF NOT EXISTS idx_question_suggestions_category ON question_suggestions(category);
CREATE INDEX IF NOT EXISTS idx_question_suggestions_aws_service ON question_suggestions(aws_service);
CREATE INDEX IF NOT EXISTS idx_question_suggestions_usage_count ON question_suggestions(usage_count);
CREATE INDEX IF NOT EXISTS idx_question_suggestions_is_active ON question_suggestions(is_active);