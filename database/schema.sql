CREATE TABLE IF NOT EXISTS ticket_records (
    id TEXT PRIMARY KEY,
    ticket_type TEXT NOT NULL CHECK (ticket_type IN ('flight', 'train')),
    source_type TEXT NOT NULL DEFAULT 'manual',
    carrier_name TEXT NOT NULL,
    code TEXT NOT NULL,
    raw_payload_json TEXT NOT NULL,
    normalized_status TEXT NOT NULL DEFAULT 'pending',
    journey_id TEXT,
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ticket_itineraries (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    journey_type TEXT NOT NULL CHECK (journey_type IN ('single_leg', 'multi_leg')),
    primary_ticket_type TEXT NOT NULL CHECK (primary_ticket_type IN ('flight', 'train', 'mixed')),
    status TEXT NOT NULL CHECK (status IN ('planned', 'completed', 'archived')),
    start_time_utc TEXT NOT NULL,
    end_time_utc TEXT NOT NULL,
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journeys (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    destination TEXT,
    date_mode TEXT NOT NULL CHECK (date_mode IN ('auto', 'manual')),
    start_date TEXT,
    end_date TEXT,
    notes TEXT,
    rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
    mood TEXT,
    cost_amount REAL,
    cost_currency TEXT,
    lodging TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journey_tickets (
    id TEXT PRIMARY KEY,
    journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
    ticket_id TEXT NOT NULL REFERENCES ticket_records(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    UNIQUE(journey_id, ticket_id)
);

CREATE TABLE IF NOT EXISTS journey_companions (
    id TEXT PRIMARY KEY,
    journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    location_type TEXT NOT NULL CHECK (location_type IN ('airport', 'station', 'city', 'country', 'unknown')),
    code TEXT,
    name_zh TEXT,
    name_en TEXT,
    latitude REAL,
    longitude REAL,
    timezone TEXT,
    country_code TEXT,
    confidence_score REAL,
    source TEXT NOT NULL DEFAULT 'user'
);

CREATE TABLE IF NOT EXISTS ticket_segments (
    id TEXT PRIMARY KEY,
    journey_id TEXT NOT NULL REFERENCES ticket_itineraries(id),
    segment_index INTEGER NOT NULL,
    transport_type TEXT NOT NULL CHECK (transport_type IN ('flight', 'train')),
    carrier_name TEXT NOT NULL,
    code TEXT NOT NULL,
    departure_location_id TEXT REFERENCES locations(id),
    arrival_location_id TEXT REFERENCES locations(id),
    departure_name_raw TEXT NOT NULL,
    arrival_name_raw TEXT NOT NULL,
    departure_time_local TEXT NOT NULL,
    arrival_time_local TEXT NOT NULL,
    departure_timezone TEXT NOT NULL,
    arrival_timezone TEXT NOT NULL,
    departure_time_utc TEXT NOT NULL,
    arrival_time_utc TEXT NOT NULL,
    class_info TEXT,
    seat_info TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS rendered_artifacts (
    id TEXT PRIMARY KEY,
    owner_type TEXT NOT NULL CHECK (owner_type IN ('ticket', 'journey', 'segment')),
    owner_id TEXT NOT NULL,
    artifact_type TEXT NOT NULL CHECK (artifact_type IN ('ticket_stub_png', 'map_thumbnail_png', 'export_json', 'export_csv')),
    render_version TEXT NOT NULL,
    file_path TEXT NOT NULL,
    checksum TEXT NOT NULL,
    created_at_utc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ticket_attachments (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES ticket_records(id),
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    created_at_utc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS airlines (
    id TEXT PRIMARY KEY,
    iata_code TEXT NOT NULL,
    icao_code TEXT,
    name_en TEXT NOT NULL,
    name_zh TEXT,
    aliases_json TEXT NOT NULL DEFAULT '[]',
    country_code TEXT,
    logo_key TEXT,
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL,
    UNIQUE(iata_code),
    UNIQUE(icao_code)
);

CREATE TABLE IF NOT EXISTS location_directory (
    id TEXT PRIMARY KEY,
    location_type TEXT NOT NULL CHECK (location_type IN ('airport', 'station', 'city', 'country', 'unknown')),
    code TEXT,
    name_zh TEXT,
    name_en TEXT,
    aliases_json TEXT NOT NULL DEFAULT '[]',
    latitude REAL,
    longitude REAL,
    timezone TEXT,
    country_code TEXT,
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_records_type_created
    ON ticket_records(ticket_type, created_at_utc);

CREATE INDEX IF NOT EXISTS idx_ticket_itineraries_status_start
    ON ticket_itineraries(status, start_time_utc);

CREATE INDEX IF NOT EXISTS idx_journeys_start_date
    ON journeys(start_date);

CREATE INDEX IF NOT EXISTS idx_journeys_end_date
    ON journeys(end_date);

CREATE INDEX IF NOT EXISTS idx_journey_tickets_journey
    ON journey_tickets(journey_id, created_at);

CREATE INDEX IF NOT EXISTS idx_journey_tickets_ticket
    ON journey_tickets(ticket_id);

CREATE INDEX IF NOT EXISTS idx_journey_companions_journey
    ON journey_companions(journey_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ticket_segments_departure_utc
    ON ticket_segments(departure_time_utc);

CREATE INDEX IF NOT EXISTS idx_ticket_segments_route
    ON ticket_segments(departure_location_id, arrival_location_id);

CREATE INDEX IF NOT EXISTS idx_rendered_artifacts_owner
    ON rendered_artifacts(owner_type, owner_id, artifact_type);

CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_created
    ON ticket_attachments(ticket_id, created_at_utc DESC);

CREATE INDEX IF NOT EXISTS idx_airlines_iata
    ON airlines(iata_code);

CREATE INDEX IF NOT EXISTS idx_airlines_name_en
    ON airlines(name_en);

CREATE INDEX IF NOT EXISTS idx_location_directory_code
    ON location_directory(code);

CREATE INDEX IF NOT EXISTS idx_location_directory_name_en
    ON location_directory(name_en);
