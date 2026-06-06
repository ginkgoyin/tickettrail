use crate::models::{
    AirlinePayload, BackupReadinessPayload, BackupRecordPayload, LocationDirectoryPayload,
    JourneyCompanionPayload, JourneyMutationPayload, JourneyPayload, MapPointPayload,
    MapRoutePayload, MapViewportPayload, MapSegmentPayload, StubPreviewPayload, TicketAttachmentPayload,
    TicketAttachmentUploadPayload, TicketDetailPayload, TicketDraftPayload, TicketLocationPayload,
    TicketRecordPayload, TicketSegmentPayload,
};
use chrono::{DateTime, LocalResult, NaiveDate, NaiveDateTime, TimeZone, Utc};
use chrono_tz::Tz;
use rusqlite::{params, Connection, Row};
use std::{
    cmp::Ordering,
    collections::HashSet,
    ffi::OsStr,
    fs,
    path::{Path, PathBuf},
    process::Command,
};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const SCHEMA_SQL: &str = include_str!("../../database/schema.sql");
const AIRLINES_SEED_JSON: &str = include_str!("../../src/data/airlines.seed.json");
const LOCATIONS_SEED_JSON: &str = include_str!("../../src/data/locations.seed.json");
const LEGACY_JOURNEYS_TABLE: &str = "journeys";
const LEGACY_SEGMENTS_TABLE: &str = "segments";
const TICKET_ITINERARIES_TABLE: &str = "ticket_itineraries";
const TICKET_SEGMENTS_TABLE: &str = "ticket_segments";

#[derive(Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct AirlineSeedEntry {
    iata_code: String,
    icao_code: Option<String>,
    name_en: String,
    name_zh: Option<String>,
    aliases: Vec<String>,
    country_code: Option<String>,
    logo_key: Option<String>,
}

#[derive(Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct LocationSeedEntry {
    id: String,
    location_type: String,
    code: Option<String>,
    name_zh: Option<String>,
    name_en: Option<String>,
    aliases: Vec<String>,
    latitude: Option<f64>,
    longitude: Option<f64>,
    timezone: Option<String>,
    country_code: Option<String>,
}

struct TicketRowData {
    id: String,
    ticket_type: String,
    carrier_name: String,
    code: String,
    raw_payload_json: String,
    normalized_status: String,
    journey_id: Option<String>,
    created_at: String,
    updated_at: String,
}

struct AttachmentRowData {
    id: String,
    ticket_id: String,
    file_name: String,
    mime_type: String,
    file_size: i64,
    file_path: String,
    created_at: String,
}

struct JourneyRowData {
    id: String,
    title: String,
    destination: Option<String>,
    date_mode: String,
    start_date: Option<String>,
    end_date: Option<String>,
    notes: Option<String>,
    rating: Option<i64>,
    mood: Option<String>,
    cost_amount: Option<f64>,
    cost_currency: Option<String>,
    lodging: Option<String>,
    created_at: String,
    updated_at: String,
}

struct LinkedJourneyTicketRecord {
    ticket_id: String,
    start_date: Option<String>,
    end_date: Option<String>,
    created_at: String,
}

struct NormalizedJourneyMutation {
    title: String,
    destination: Option<String>,
    date_mode: String,
    start_date: Option<String>,
    end_date: Option<String>,
    notes: Option<String>,
    rating: Option<i64>,
    mood: Option<String>,
    cost_amount: Option<f64>,
    cost_currency: Option<String>,
    lodging: Option<String>,
    companion_names: Vec<String>,
    ticket_ids: Vec<String>,
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupManifest {
    id: String,
    label: String,
    created_at: String,
    ticket_count: usize,
    attachment_count: usize,
    database_size_bytes: u64,
}

pub fn search_airlines(app: &AppHandle, query: &str) -> Result<Vec<AirlinePayload>, String> {
    let conn = open_connection(app)?;
    let trimmed = query.trim();

    let sql = if trimmed.is_empty() {
        "SELECT id, iata_code, icao_code, name_en, name_zh, aliases_json, country_code, logo_key
         FROM airlines
         ORDER BY name_en ASC
         LIMIT 8"
    } else {
        "SELECT id, iata_code, icao_code, name_en, name_zh, aliases_json, country_code, logo_key
         FROM airlines
         WHERE upper(iata_code) LIKE upper(?1)
            OR upper(COALESCE(icao_code, '')) LIKE upper(?1)
            OR upper(name_en) LIKE upper(?1)
            OR upper(COALESCE(name_zh, '')) LIKE upper(?1)
            OR upper(aliases_json) LIKE upper(?1)
         ORDER BY
            CASE
                WHEN upper(iata_code) = upper(?2) THEN 0
                WHEN upper(COALESCE(icao_code, '')) = upper(?2) THEN 1
                WHEN upper(name_en) = upper(?2) THEN 2
                WHEN upper(COALESCE(name_zh, '')) = upper(?2) THEN 3
                ELSE 4
            END,
            name_en ASC
         LIMIT 8"
    };

    let mut stmt = conn.prepare(sql).map_err(|err| err.to_string())?;
    let search_like = format!("%{}%", trimmed);

    let rows = if trimmed.is_empty() {
        stmt.query_map([], parse_airline_row).map_err(|err| err.to_string())?
    } else {
        stmt.query_map(params![&search_like, trimmed], parse_airline_row)
            .map_err(|err| err.to_string())?
    };

    rows.collect::<Result<Vec<_>, _>>().map_err(|err| err.to_string())
}

pub fn search_locations(app: &AppHandle, query: &str) -> Result<Vec<LocationDirectoryPayload>, String> {
    let conn = open_connection(app)?;
    let trimmed = query.trim();

    let sql = if trimmed.is_empty() {
        "SELECT id, location_type, code, name_zh, name_en, aliases_json, latitude, longitude, timezone, country_code
         FROM location_directory
         ORDER BY name_en ASC
         LIMIT 8"
    } else {
        "SELECT id, location_type, code, name_zh, name_en, aliases_json, latitude, longitude, timezone, country_code
         FROM location_directory
         WHERE upper(COALESCE(code, '')) LIKE upper(?1)
            OR upper(COALESCE(name_en, '')) LIKE upper(?1)
            OR upper(COALESCE(name_zh, '')) LIKE upper(?1)
            OR upper(aliases_json) LIKE upper(?1)
         ORDER BY
            CASE
                WHEN upper(COALESCE(code, '')) = upper(?2) THEN 0
                WHEN upper(COALESCE(name_en, '')) = upper(?2) THEN 1
                WHEN upper(COALESCE(name_zh, '')) = upper(?2) THEN 2
                ELSE 3
            END,
            name_en ASC
         LIMIT 8"
    };

    let mut stmt = conn.prepare(sql).map_err(|err| err.to_string())?;
    let search_like = format!("%{}%", trimmed);

    let rows = if trimmed.is_empty() {
        stmt.query_map([], parse_location_directory_row)
            .map_err(|err| err.to_string())?
    } else {
        stmt.query_map(params![&search_like, trimmed], parse_location_directory_row)
            .map_err(|err| err.to_string())?
    };

    rows.collect::<Result<Vec<_>, _>>().map_err(|err| err.to_string())
}

pub fn list_backups(app: &AppHandle) -> Result<Vec<BackupRecordPayload>, String> {
    let backup_root = backup_root_dir(app)?;
    if !backup_root.exists() {
        return Ok(Vec::new());
    }

    let mut backups = Vec::new();
    for entry in fs::read_dir(&backup_root).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        if !entry.file_type().map_err(|err| err.to_string())?.is_dir() {
            continue;
        }

        let manifest_path = entry.path().join("backup.json");
        if !manifest_path.exists() {
            continue;
        }

        let manifest_text = fs::read_to_string(&manifest_path).map_err(|err| err.to_string())?;
        let manifest =
            serde_json::from_str::<BackupManifest>(&manifest_text).map_err(|err| err.to_string())?;
        backups.push(BackupRecordPayload {
            id: manifest.id,
            label: manifest.label,
            created_at: manifest.created_at,
            ticket_count: manifest.ticket_count,
            attachment_count: manifest.attachment_count,
            database_size_bytes: manifest.database_size_bytes,
        });
    }

    backups.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(backups)
}

pub fn create_backup(app: &AppHandle) -> Result<BackupRecordPayload, String> {
    let conn = open_connection(app)?;
    let ticket_count = list_tickets(app)?.len();
    let attachment_count = count_attachments(&conn)?;
    drop(conn);

    let created_at = Utc::now().to_rfc3339();
    let created_at_dt = DateTime::parse_from_rfc3339(&created_at).map_err(|err| err.to_string())?;
    let backup_id = format!("backup-{}", created_at_dt.format("%Y%m%d-%H%M%S"));
    let backup_dir = backup_root_dir(app)?.join(&backup_id);
    fs::create_dir_all(&backup_dir).map_err(|err| err.to_string())?;

    let db_source = database_path(app)?;
    let db_destination = backup_dir.join("tickettrail.sqlite3");
    fs::copy(&db_source, &db_destination).map_err(|err| err.to_string())?;

    let attachment_source = attachment_root_dir(app)?;
    let attachment_destination = backup_dir.join("attachments");
    if attachment_source.exists() {
        copy_dir_recursive(&attachment_source, &attachment_destination)?;
    }

    let database_size_bytes = fs::metadata(&db_destination)
        .map_err(|err| err.to_string())?
        .len();
    let manifest = BackupManifest {
        id: backup_id.clone(),
        label: format!("Backup {}", created_at_dt.format("%Y-%m-%d %H:%M:%S")),
        created_at: created_at.clone(),
        ticket_count,
        attachment_count,
        database_size_bytes,
    };

    let manifest_text = serde_json::to_string_pretty(&manifest).map_err(|err| err.to_string())?;
    fs::write(backup_dir.join("backup.json"), manifest_text).map_err(|err| err.to_string())?;

    Ok(BackupRecordPayload {
        id: manifest.id,
        label: manifest.label,
        created_at: manifest.created_at,
        ticket_count: manifest.ticket_count,
        attachment_count: manifest.attachment_count,
        database_size_bytes: manifest.database_size_bytes,
    })
}

pub fn get_backup_readiness(app: &AppHandle) -> Result<BackupReadinessPayload, String> {
    let conn = open_connection(app)?;
    let db_path = database_path(app)?;
    let attachment_root = attachment_root_dir(app)?;
    Ok(BackupReadinessPayload {
        database_exists: db_path.exists(),
        database_path: db_path.to_string_lossy().to_string(),
        attachment_root_path: attachment_root.to_string_lossy().to_string(),
        ticket_count: list_tickets(app)?.len(),
        attachment_count: count_attachments(&conn)?,
    })
}

pub fn restore_backup(app: &AppHandle, backup_id: &str) -> Result<(), String> {
    let backup_dir = backup_root_dir(app)?.join(backup_id);
    restore_from_backup_dir(app, &backup_dir)
}

pub fn export_backup(app: &AppHandle, backup_id: &str) -> Result<String, String> {
    let backup_dir = backup_root_dir(app)?.join(backup_id);
    if !backup_dir.exists() {
        return Err(format!("Backup {} was not found.", backup_id));
    }

    let export_root = export_root_dir(app)?;
    let export_dir = export_root.join(backup_id);
    if export_dir.exists() {
        fs::remove_dir_all(&export_dir).map_err(|err| err.to_string())?;
    }

    copy_dir_recursive(&backup_dir, &export_dir)?;
    Ok(export_dir.to_string_lossy().to_string())
}

pub fn export_archive_bundle(app: &AppHandle) -> Result<String, String> {
    let backup = create_backup(app)?;
    let backup_dir = backup_root_dir(app)?.join(&backup.id);
    let export_root = export_root_dir(app)?;
    fs::create_dir_all(&export_root).map_err(|err| err.to_string())?;

    let archive_path = export_root.join(format!("{}-archive.zip", backup.id));
    if archive_path.exists() {
        fs::remove_file(&archive_path).map_err(|err| err.to_string())?;
    }

    compress_directory_to_zip(&backup_dir, &archive_path)?;
    Ok(archive_path.to_string_lossy().to_string())
}

pub fn import_archive_bundle(app: &AppHandle, bundle_path: &str) -> Result<(), String> {
    let archive_path = PathBuf::from(bundle_path);
    if !archive_path.exists() {
        return Err(format!("Archive bundle was not found: {}", bundle_path));
    }

    let import_root = app
        .path()
        .app_data_dir()
        .map_err(|err| err.to_string())?
        .join("imports")
        .join(Uuid::new_v4().to_string());
    fs::create_dir_all(&import_root).map_err(|err| err.to_string())?;

    expand_zip_to_directory(&archive_path, &import_root)?;
    let extracted_backup_dir = locate_backup_dir(&import_root)?;
    restore_from_backup_dir(app, &extracted_backup_dir)
}

pub fn list_tickets(app: &AppHandle) -> Result<Vec<TicketRecordPayload>, String> {
    let conn = open_connection(app)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, ticket_type, carrier_name, code, raw_payload_json, normalized_status, journey_id, created_at_utc, updated_at_utc
             FROM ticket_records
             ORDER BY created_at_utc DESC",
        )
        .map_err(|err| err.to_string())?;

    let rows = stmt.query_map([], parse_ticket_row).map_err(|err| err.to_string())?;

    rows.map(|row| row.and_then(ticket_row_to_record))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())
}

pub fn list_journeys(app: &AppHandle) -> Result<Vec<JourneyPayload>, String> {
    let conn = open_connection(app)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, title, destination, date_mode, start_date, end_date, notes,
                    rating, mood, cost_amount, cost_currency, lodging, created_at, updated_at
             FROM journeys
             ORDER BY
                COALESCE(start_date, end_date, updated_at) DESC,
                updated_at DESC,
                title COLLATE NOCASE ASC",
        )
        .map_err(|err| err.to_string())?;

    let rows = stmt.query_map([], parse_journey_row).map_err(|err| err.to_string())?;
    let journey_rows = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;

    journey_rows
        .into_iter()
        .map(|row| journey_row_to_payload(&conn, row))
        .collect()
}

pub fn get_journey(app: &AppHandle, journey_id: &str) -> Result<JourneyPayload, String> {
    let conn = open_connection(app)?;
    let row = get_journey_row(&conn, journey_id)?;
    journey_row_to_payload(&conn, row)
}

pub fn create_journey(app: &AppHandle, input: JourneyMutationPayload) -> Result<JourneyPayload, String> {
    let conn = open_connection(app)?;
    let normalized = normalize_journey_mutation(&conn, input)?;
    let journey_id = Uuid::new_v4().to_string();
    let created_at = Utc::now().to_rfc3339();

    conn.execute_batch("BEGIN IMMEDIATE TRANSACTION;")
        .map_err(|err| err.to_string())?;

    let result = (|| {
        conn.execute(
            "INSERT INTO journeys (
                id, title, destination, date_mode, start_date, end_date, notes,
                rating, mood, cost_amount, cost_currency, lodging, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![
                &journey_id,
                &normalized.title,
                &normalized.destination,
                &normalized.date_mode,
                &normalized.start_date,
                &normalized.end_date,
                &normalized.notes,
                &normalized.rating,
                &normalized.mood,
                &normalized.cost_amount,
                &normalized.cost_currency,
                &normalized.lodging,
                &created_at,
                &created_at,
            ],
        )
        .map_err(|err| err.to_string())?;

        replace_journey_ticket_links(&conn, &journey_id, &normalized.ticket_ids, &created_at)?;
        replace_journey_companions(&conn, &journey_id, &normalized.companion_names, &created_at)?;

        conn.execute_batch("COMMIT;").map_err(|err| err.to_string())?;
        get_journey_row(&conn, &journey_id)
    })();

    if result.is_err() {
        let _ = conn.execute_batch("ROLLBACK;");
    }

    result.and_then(|row| journey_row_to_payload(&conn, row))
}

pub fn update_journey(
    app: &AppHandle,
    journey_id: &str,
    input: JourneyMutationPayload,
) -> Result<JourneyPayload, String> {
    let conn = open_connection(app)?;
    let existing = get_journey_row(&conn, journey_id)?;
    let normalized = normalize_journey_mutation(&conn, input)?;
    let updated_at = Utc::now().to_rfc3339();

    conn.execute_batch("BEGIN IMMEDIATE TRANSACTION;")
        .map_err(|err| err.to_string())?;

    let result = (|| {
        conn.execute(
            "UPDATE journeys
             SET title = ?1,
                 destination = ?2,
                 date_mode = ?3,
                 start_date = ?4,
                 end_date = ?5,
                 notes = ?6,
                 rating = ?7,
                 mood = ?8,
                 cost_amount = ?9,
                 cost_currency = ?10,
                 lodging = ?11,
                 updated_at = ?12
             WHERE id = ?13",
            params![
                &normalized.title,
                &normalized.destination,
                &normalized.date_mode,
                &normalized.start_date,
                &normalized.end_date,
                &normalized.notes,
                &normalized.rating,
                &normalized.mood,
                &normalized.cost_amount,
                &normalized.cost_currency,
                &normalized.lodging,
                &updated_at,
                &existing.id,
            ],
        )
        .map_err(|err| err.to_string())?;

        replace_journey_ticket_links(&conn, &existing.id, &normalized.ticket_ids, &updated_at)?;
        replace_journey_companions(&conn, &existing.id, &normalized.companion_names, &updated_at)?;

        conn.execute_batch("COMMIT;").map_err(|err| err.to_string())?;
        get_journey_row(&conn, &existing.id)
    })();

    if result.is_err() {
        let _ = conn.execute_batch("ROLLBACK;");
    }

    result.and_then(|row| journey_row_to_payload(&conn, row))
}

pub fn delete_journey(app: &AppHandle, journey_id: &str) -> Result<(), String> {
    let conn = open_connection(app)?;
    let _ = get_journey_row(&conn, journey_id)?;

    conn.execute_batch("BEGIN IMMEDIATE TRANSACTION;")
        .map_err(|err| err.to_string())?;

    let result = (|| {
        conn.execute("DELETE FROM journey_companions WHERE journey_id = ?1", [journey_id])
            .map_err(|err| err.to_string())?;
        conn.execute("DELETE FROM journey_tickets WHERE journey_id = ?1", [journey_id])
            .map_err(|err| err.to_string())?;
        conn.execute("DELETE FROM journeys WHERE id = ?1", [journey_id])
            .map_err(|err| err.to_string())?;
        conn.execute_batch("COMMIT;").map_err(|err| err.to_string())
    })();

    if result.is_err() {
        let _ = conn.execute_batch("ROLLBACK;");
    }

    result
}

pub fn create_ticket(app: &AppHandle, draft: TicketDraftPayload) -> Result<TicketRecordPayload, String> {
    validate_draft(&draft)?;

    let effective_segments = build_effective_segments(&draft);
    let first_segment = effective_segments
        .first()
        .ok_or_else(|| "At least one segment is required.".to_string())?;
    let last_segment = effective_segments
        .last()
        .ok_or_else(|| "At least one segment is required.".to_string())?;
    let departure_time_utc =
        normalize_to_utc(&first_segment.departure_time_local, &first_segment.departure.timezone)?;
    let arrival_time_utc =
        normalize_to_utc(&last_segment.arrival_time_local, &last_segment.arrival.timezone)?;
    let created_at = Utc::now().to_rfc3339();

    let ticket_id = Uuid::new_v4().to_string();
    let itinerary_id = Uuid::new_v4().to_string();

    let conn = open_connection(app)?;
    let raw_payload_json = serde_json::to_string(&draft).map_err(|err| err.to_string())?;
    let route_label = format!(
        "{} -> {}",
        first_segment.departure.name, last_segment.arrival.name
    );
    let journey_type = if effective_segments.len() > 1 {
        "multi_leg"
    } else {
        "single_leg"
    };

    conn.execute_batch("BEGIN IMMEDIATE TRANSACTION;")
        .map_err(|err| err.to_string())?;

    let result = (|| {
        conn.execute(
            "INSERT INTO ticket_itineraries (
                id, title, journey_type, primary_ticket_type, status,
                start_time_utc, end_time_utc, created_at_utc, updated_at_utc
             ) VALUES (?1, ?2, ?3, ?4, 'planned', ?5, ?6, ?7, ?8)",
            params![
                &itinerary_id,
                &route_label,
                &journey_type,
                &draft.ticket_type,
                &departure_time_utc,
                &arrival_time_utc,
                &created_at,
                &created_at
            ],
        )
        .map_err(|err| err.to_string())?;

        insert_segments(&conn, &itinerary_id, &draft.ticket_type, &effective_segments)?;

        conn.execute(
            "INSERT INTO ticket_records (
                id, ticket_type, source_type, carrier_name, code, raw_payload_json,
                normalized_status, journey_id, created_at_utc, updated_at_utc, version
             ) VALUES (?1, ?2, 'manual', ?3, ?4, ?5, 'saved', ?6, ?7, ?8, 1)",
            params![
                &ticket_id,
                &draft.ticket_type,
                &draft.carrier_name,
                &draft.code,
                &raw_payload_json,
                &itinerary_id,
                &created_at,
                &created_at
            ],
        )
        .map_err(|err| err.to_string())?;

        conn.execute_batch("COMMIT;").map_err(|err| err.to_string())?;

        Ok(build_ticket_record(
            ticket_id,
            draft.ticket_type.clone(),
            draft.carrier_name.clone(),
            draft.code.clone(),
            draft,
            "saved".to_string(),
            created_at.clone(),
            created_at,
        ))
    })();

    if result.is_err() {
        let _ = conn.execute_batch("ROLLBACK;");
    }

    result
}

pub fn update_ticket(
    app: &AppHandle,
    ticket_id: &str,
    draft: TicketDraftPayload,
) -> Result<TicketRecordPayload, String> {
    validate_draft(&draft)?;

    let effective_segments = build_effective_segments(&draft);
    let first_segment = effective_segments
        .first()
        .ok_or_else(|| "At least one segment is required.".to_string())?;
    let last_segment = effective_segments
        .last()
        .ok_or_else(|| "At least one segment is required.".to_string())?;
    let departure_time_utc =
        normalize_to_utc(&first_segment.departure_time_local, &first_segment.departure.timezone)?;
    let arrival_time_utc =
        normalize_to_utc(&last_segment.arrival_time_local, &last_segment.arrival.timezone)?;
    let updated_at = Utc::now().to_rfc3339();

    let conn = open_connection(app)?;
    let existing_row = get_ticket_row(&conn, ticket_id)?;
    let itinerary_id = existing_row
        .journey_id
        .clone()
        .ok_or_else(|| "Ticket itinerary relation is missing.".to_string())?;
    let raw_payload_json = serde_json::to_string(&draft).map_err(|err| err.to_string())?;
    let route_label = format!(
        "{} -> {}",
        first_segment.departure.name, last_segment.arrival.name
    );
    let journey_type = if effective_segments.len() > 1 {
        "multi_leg"
    } else {
        "single_leg"
    };

    conn.execute_batch("BEGIN IMMEDIATE TRANSACTION;")
        .map_err(|err| err.to_string())?;

    let result = (|| {
        conn.execute(
            "UPDATE ticket_itineraries
             SET title = ?1,
                 journey_type = ?2,
                 primary_ticket_type = ?3,
                 start_time_utc = ?4,
                 end_time_utc = ?5,
                 updated_at_utc = ?6
             WHERE id = ?7",
            params![
                &route_label,
                &journey_type,
                &draft.ticket_type,
                &departure_time_utc,
                &arrival_time_utc,
                &updated_at,
                &itinerary_id
            ],
        )
        .map_err(|err| err.to_string())?;

        conn.execute("DELETE FROM ticket_segments WHERE journey_id = ?1", [&itinerary_id])
            .map_err(|err| err.to_string())?;
        insert_segments(&conn, &itinerary_id, &draft.ticket_type, &effective_segments)?;

        conn.execute(
            "UPDATE ticket_records
             SET ticket_type = ?1,
                 carrier_name = ?2,
                 code = ?3,
                 raw_payload_json = ?4,
                 updated_at_utc = ?5,
                 version = version + 1
             WHERE id = ?6",
            params![
                &draft.ticket_type,
                &draft.carrier_name,
                &draft.code,
                &raw_payload_json,
                &updated_at,
                &existing_row.id
            ],
        )
        .map_err(|err| err.to_string())?;

        conn.execute_batch("COMMIT;").map_err(|err| err.to_string())?;

        Ok(build_ticket_record(
            existing_row.id,
            draft.ticket_type.clone(),
            draft.carrier_name.clone(),
            draft.code.clone(),
            draft,
            map_status(&existing_row.normalized_status),
            existing_row.created_at,
            updated_at,
        ))
    })();

    if result.is_err() {
        let _ = conn.execute_batch("ROLLBACK;");
    }

    result
}

pub fn update_ticket_status(
    app: &AppHandle,
    ticket_id: &str,
    status: &str,
) -> Result<TicketRecordPayload, String> {
    validate_status(status)?;

    let conn = open_connection(app)?;
    let existing_row = get_ticket_row(&conn, ticket_id)?;
    let itinerary_id = existing_row
        .journey_id
        .clone()
        .ok_or_else(|| "Ticket itinerary relation is missing.".to_string())?;
    let updated_at = Utc::now().to_rfc3339();
    let draft = deserialize_ticket_draft(&existing_row.raw_payload_json)?;

    conn.execute_batch("BEGIN IMMEDIATE TRANSACTION;")
        .map_err(|err| err.to_string())?;

    let result = (|| {
        conn.execute(
            "UPDATE ticket_records
             SET normalized_status = ?1,
                 updated_at_utc = ?2,
                 version = version + 1
             WHERE id = ?3",
            params![status, &updated_at, &existing_row.id],
        )
        .map_err(|err| err.to_string())?;

        conn.execute(
            "UPDATE ticket_itineraries
             SET status = ?1,
                 updated_at_utc = ?2
             WHERE id = ?3",
            params![journey_status_for_ticket_status(status), &updated_at, &itinerary_id],
        )
        .map_err(|err| err.to_string())?;

        conn.execute_batch("COMMIT;").map_err(|err| err.to_string())?;

        Ok(build_ticket_record(
            existing_row.id,
            existing_row.ticket_type,
            existing_row.carrier_name,
            existing_row.code,
            draft,
            status.to_string(),
            existing_row.created_at,
            updated_at,
        ))
    })();

    if result.is_err() {
        let _ = conn.execute_batch("ROLLBACK;");
    }

    result
}

pub fn delete_ticket(app: &AppHandle, ticket_id: &str) -> Result<(), String> {
    let conn = open_connection(app)?;
    let existing_row = get_ticket_row(&conn, ticket_id)?;
    let itinerary_id = existing_row
        .journey_id
        .clone()
        .ok_or_else(|| "Ticket itinerary relation is missing.".to_string())?;
    let attachments = list_ticket_attachments(&conn, ticket_id)?;

    conn.execute_batch("BEGIN IMMEDIATE TRANSACTION;")
        .map_err(|err| err.to_string())?;

    let result = (|| {
        conn.execute("DELETE FROM ticket_attachments WHERE ticket_id = ?1", [ticket_id])
            .map_err(|err| err.to_string())?;
        conn.execute("DELETE FROM journey_tickets WHERE ticket_id = ?1", [ticket_id])
            .map_err(|err| err.to_string())?;
        conn.execute("DELETE FROM ticket_records WHERE id = ?1", [ticket_id])
            .map_err(|err| err.to_string())?;
        conn.execute("DELETE FROM ticket_segments WHERE journey_id = ?1", [&itinerary_id])
            .map_err(|err| err.to_string())?;
        conn.execute("DELETE FROM ticket_itineraries WHERE id = ?1", [&itinerary_id])
            .map_err(|err| err.to_string())?;
        conn.execute_batch("COMMIT;").map_err(|err| err.to_string())
    })();

    if result.is_err() {
        let _ = conn.execute_batch("ROLLBACK;");
        return result;
    }

    for attachment in attachments {
        let _ = fs::remove_file(&attachment.file_path);
    }
    let attachment_dir = attachment_ticket_dir(app, ticket_id)?;
    if attachment_dir.exists() {
        let _ = fs::remove_dir_all(attachment_dir);
    }

    Ok(())
}

pub fn add_ticket_attachment(
    app: &AppHandle,
    ticket_id: &str,
    upload: TicketAttachmentUploadPayload,
) -> Result<TicketAttachmentPayload, String> {
    if upload.bytes.is_empty() {
        return Err("Attachment file is empty.".to_string());
    }

    let conn = open_connection(app)?;
    let _ = get_ticket_row(&conn, ticket_id)?;

    let attachment_id = Uuid::new_v4().to_string();
    let created_at = Utc::now().to_rfc3339();
    let file_name = sanitize_file_name(&upload.file_name);
    let stored_name = build_stored_file_name(&attachment_id, &file_name);
    let ticket_dir = attachment_ticket_dir(app, ticket_id)?;
    fs::create_dir_all(&ticket_dir).map_err(|err| err.to_string())?;
    let stored_path = ticket_dir.join(stored_name);
    fs::write(&stored_path, &upload.bytes).map_err(|err| err.to_string())?;

    conn.execute(
        "INSERT INTO ticket_attachments (
            id, ticket_id, file_name, mime_type, file_size, file_path, created_at_utc
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            &attachment_id,
            ticket_id,
            &file_name,
            &upload.mime_type,
            upload.bytes.len() as i64,
            stored_path.to_string_lossy().to_string(),
            &created_at
        ],
    )
    .map_err(|err| {
        let _ = fs::remove_file(&stored_path);
        err.to_string()
    })?;

    touch_ticket_updated_at(&conn, ticket_id, &created_at)?;

    Ok(TicketAttachmentPayload {
        id: attachment_id,
        ticket_id: ticket_id.to_string(),
        file_name,
        mime_type: upload.mime_type,
        file_size: upload.bytes.len() as u64,
        created_at,
        file_path: stored_path.to_string_lossy().to_string(),
    })
}

pub fn delete_ticket_attachment(app: &AppHandle, attachment_id: &str) -> Result<(), String> {
    let conn = open_connection(app)?;
    let attachment = get_attachment_row(&conn, attachment_id)?;

    conn.execute("DELETE FROM ticket_attachments WHERE id = ?1", [attachment_id])
        .map_err(|err| err.to_string())?;
    let updated_at = Utc::now().to_rfc3339();
    touch_ticket_updated_at(&conn, &attachment.ticket_id, &updated_at)?;

    if Path::new(&attachment.file_path).exists() {
        fs::remove_file(&attachment.file_path).map_err(|err| err.to_string())?;
    }

    let ticket_dir = attachment_ticket_dir(app, &attachment.ticket_id)?;
    if ticket_dir.exists() && fs::read_dir(&ticket_dir).map_err(|err| err.to_string())?.next().is_none() {
        let _ = fs::remove_dir(ticket_dir);
    }

    Ok(())
}

pub fn get_ticket_detail(app: &AppHandle, ticket_id: &str) -> Result<TicketDetailPayload, String> {
    let conn = open_connection(app)?;
    let row = get_ticket_row(&conn, ticket_id)?;
    let attachments = list_ticket_attachments(&conn, ticket_id)?;
    let ticket = ticket_row_to_record(row).map_err(|err| err.to_string())?;
    Ok(build_ticket_detail(&conn, ticket, attachments))
}

fn build_ticket_record(
    id: String,
    ticket_type: String,
    carrier_name: String,
    code: String,
    draft: TicketDraftPayload,
    normalized_status: String,
    created_at: String,
    updated_at: String,
) -> TicketRecordPayload {
    let effective_segments = build_effective_segments(&draft);
    let first_segment = effective_segments.first().cloned().unwrap_or_else(|| TicketSegmentPayload {
        carrier_name: carrier_name.clone(),
        code: code.clone(),
        departure: draft.departure.clone(),
        arrival: draft.arrival.clone(),
        departure_terminal: draft.departure_terminal.clone(),
        arrival_terminal: draft.arrival_terminal.clone(),
        departure_time_local: draft.departure_time_local.clone(),
        arrival_time_local: draft.arrival_time_local.clone(),
        class_info: draft.class_info.clone(),
        seat_info: draft.seat_info.clone(),
        notes: draft.notes.clone(),
    });
    let last_segment = effective_segments.last().cloned().unwrap_or_else(|| first_segment.clone());
    let route_label = format!("{} -> {}", first_segment.departure.name, last_segment.arrival.name);

    TicketRecordPayload {
        id,
        ticket_type,
        carrier_name,
        code,
        departure: TicketLocationPayload {
            name: first_segment.departure.name,
            code: normalize_optional_string(first_segment.departure.code),
            timezone: first_segment.departure.timezone,
        },
        arrival: TicketLocationPayload {
            name: last_segment.arrival.name,
            code: normalize_optional_string(last_segment.arrival.code),
            timezone: last_segment.arrival.timezone,
        },
        departure_terminal: normalize_optional_string(first_segment.departure_terminal),
        arrival_terminal: normalize_optional_string(last_segment.arrival_terminal),
        departure_time_local: first_segment.departure_time_local,
        arrival_time_local: last_segment.arrival_time_local,
        class_info: first_segment.class_info,
        seat_info: first_segment.seat_info,
        notes: draft.notes,
        route_label,
        status: map_status(&normalized_status),
        created_at,
        updated_at,
        segments: draft.segments,
        segment_count: effective_segments.len(),
    }
}

fn build_ticket_detail(
    conn: &Connection,
    ticket: TicketRecordPayload,
    attachments: Vec<TicketAttachmentPayload>,
) -> TicketDetailPayload {
    let effective_segments = build_effective_segments(&TicketDraftPayload {
        ticket_type: ticket.ticket_type.clone(),
        carrier_name: ticket.carrier_name.clone(),
        code: ticket.code.clone(),
        departure: ticket.departure.clone(),
        arrival: ticket.arrival.clone(),
        departure_terminal: ticket.departure_terminal.clone(),
        arrival_terminal: ticket.arrival_terminal.clone(),
        departure_time_local: ticket.departure_time_local.clone(),
        arrival_time_local: ticket.arrival_time_local.clone(),
        class_info: ticket.class_info.clone(),
        seat_info: ticket.seat_info.clone(),
        notes: ticket.notes.clone(),
        segments: ticket.segments.clone(),
    });
    let segment_maps = effective_segments
        .iter()
        .enumerate()
        .map(|(index, segment)| {
            let origin = resolve_map_point(conn, &segment.departure);
            let destination = resolve_map_point(conn, &segment.arrival);

            MapSegmentPayload {
                segment_index: index,
                transport_type: ticket.ticket_type.clone(),
                carrier_name: segment.carrier_name.clone(),
                code: segment.code.clone(),
                line_label: format!("{} -> {}", segment.departure.name, segment.arrival.name),
                direction_hint: format!(
                    "{} to {}",
                    segment
                        .departure
                        .code
                        .clone()
                        .unwrap_or_else(|| segment.departure.name.clone()),
                    segment
                        .arrival
                        .code
                        .clone()
                        .unwrap_or_else(|| segment.arrival.name.clone())
                ),
                distance_hint_km: estimate_distance_km(&origin, &destination),
                origin,
                destination,
            }
        })
        .collect::<Vec<_>>();
    let origin = segment_maps
        .first()
        .map(|segment| segment.origin.clone())
        .unwrap_or_else(|| resolve_map_point(conn, &ticket.departure));
    let destination = segment_maps
        .last()
        .map(|segment| segment.destination.clone())
        .unwrap_or_else(|| resolve_map_point(conn, &ticket.arrival));
    let viewport = if segment_maps.is_empty() {
        build_viewport(&origin, &destination)
    } else {
        build_segments_viewport(&segment_maps)
    };
    let distance_hint_km = segment_maps
        .iter()
        .fold(0_u32, |sum, segment| sum.saturating_add(segment.distance_hint_km));

    let map = MapRoutePayload {
        line_label: ticket.route_label.clone(),
        direction_hint: format!(
            "{} to {}",
            ticket.departure.code.clone().unwrap_or_else(|| ticket.departure.name.clone()),
            ticket.arrival.code.clone().unwrap_or_else(|| ticket.arrival.name.clone())
        ),
        distance_hint_km,
        origin,
        destination,
        viewport,
    };

    let stub = StubPreviewPayload {
        title: "Ticket Stub Preview".to_string(),
        subtitle: ticket.route_label.clone(),
        transport_badge: ticket.ticket_type.to_uppercase(),
        primary_code: ticket.code.clone(),
        departure_label: ticket.departure.name.clone(),
        departure_terminal: ticket.departure_terminal.clone(),
        departure_time_local: ticket.departure_time_local.clone(),
        arrival_label: ticket.arrival.name.clone(),
        arrival_terminal: ticket.arrival_terminal.clone(),
        arrival_time_local: ticket.arrival_time_local.clone(),
        carrier_name: ticket.carrier_name.clone(),
        seat_label: format!(
            "{} / {}",
            display_or_tbd(&ticket.class_info),
            display_or_tbd(&ticket.seat_info)
        ),
        notes: display_or_tbd(&ticket.notes),
        route_label: ticket.route_label.clone(),
        accent: "#70d4ff".to_string(),
    };

    TicketDetailPayload {
        ticket,
        map,
        segments: segment_maps,
        stub,
        attachments,
    }
}

fn map_status(value: &str) -> String {
    match value {
        "pending" => "draft".to_string(),
        "normalized" => "saved".to_string(),
        "saved" | "used" | "archived" => value.to_string(),
        _ => "saved".to_string(),
    }
}

fn build_effective_segments(draft: &TicketDraftPayload) -> Vec<TicketSegmentPayload> {
    let primary_segment = TicketSegmentPayload {
        carrier_name: draft.carrier_name.clone(),
        code: draft.code.clone(),
        departure: draft.departure.clone(),
        arrival: draft.arrival.clone(),
        departure_terminal: draft.departure_terminal.clone(),
        arrival_terminal: draft.arrival_terminal.clone(),
        departure_time_local: draft.departure_time_local.clone(),
        arrival_time_local: draft.arrival_time_local.clone(),
        class_info: draft.class_info.clone(),
        seat_info: draft.seat_info.clone(),
        notes: draft.notes.clone(),
    };

    if draft
        .segments
        .as_ref()
        .and_then(|segments| segments.first())
        .map(|segment| is_same_ticket_location(&draft.departure, &segment.departure))
        .unwrap_or(false)
    {
        return draft.segments.clone().unwrap_or_default();
    }

    let mut segments = vec![primary_segment];
    if let Some(extra_segments) = &draft.segments {
        segments.extend(extra_segments.iter().cloned());
    }
    segments
}

fn is_same_ticket_location(left: &TicketLocationPayload, right: &TicketLocationPayload) -> bool {
    let normalized_left_code = left.code.clone().unwrap_or_default().trim().to_lowercase();
    let normalized_right_code = right.code.clone().unwrap_or_default().trim().to_lowercase();

    if !normalized_left_code.is_empty() && !normalized_right_code.is_empty() {
        return normalized_left_code == normalized_right_code;
    }

    left.name.trim().to_lowercase() == right.name.trim().to_lowercase()
        && left.timezone.trim().to_lowercase() == right.timezone.trim().to_lowercase()
}

fn build_segments_viewport(segments: &[MapSegmentPayload]) -> MapViewportPayload {
    let min_latitude = segments
        .iter()
        .flat_map(|segment| [segment.origin.latitude, segment.destination.latitude])
        .fold(f64::INFINITY, f64::min);
    let max_latitude = segments
        .iter()
        .flat_map(|segment| [segment.origin.latitude, segment.destination.latitude])
        .fold(f64::NEG_INFINITY, f64::max);
    let min_longitude = segments
        .iter()
        .flat_map(|segment| [segment.origin.longitude, segment.destination.longitude])
        .fold(f64::INFINITY, f64::min);
    let max_longitude = segments
        .iter()
        .flat_map(|segment| [segment.origin.longitude, segment.destination.longitude])
        .fold(f64::NEG_INFINITY, f64::max);

    MapViewportPayload {
        min_latitude,
        max_latitude,
        min_longitude,
        max_longitude,
    }
}

fn insert_segments(
    conn: &Connection,
    journey_id: &str,
    ticket_type: &str,
    segments: &[TicketSegmentPayload],
) -> Result<(), String> {
    for (index, segment) in segments.iter().enumerate() {
        let segment_id = Uuid::new_v4().to_string();
        let departure_time_utc =
            normalize_to_utc(&segment.departure_time_local, &segment.departure.timezone)?;
        let arrival_time_utc =
            normalize_to_utc(&segment.arrival_time_local, &segment.arrival.timezone)?;

        conn.execute(
            "INSERT INTO ticket_segments (
                id, journey_id, segment_index, transport_type, carrier_name, code,
                departure_location_id, arrival_location_id, departure_name_raw, arrival_name_raw,
                departure_time_local, arrival_time_local, departure_timezone, arrival_timezone,
                departure_time_utc, arrival_time_utc, class_info, seat_info, metadata_json
             ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6,
                NULL, NULL, ?7, ?8,
                ?9, ?10, ?11, ?12,
                ?13, ?14, ?15, ?16, ?17
             )",
            params![
                &segment_id,
                journey_id,
                index as i64,
                ticket_type,
                &segment.carrier_name,
                &segment.code,
                &segment.departure.name,
                &segment.arrival.name,
                &segment.departure_time_local,
                &segment.arrival_time_local,
                &segment.departure.timezone,
                &segment.arrival.timezone,
                &departure_time_utc,
                &arrival_time_utc,
                &segment.class_info,
                &segment.seat_info,
                build_segment_metadata(segment)
            ],
        )
        .map_err(|err| err.to_string())?;
    }

    Ok(())
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value.and_then(|item| {
        let trimmed = item.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn display_or_tbd(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        "TBD".to_string()
    } else {
        trimmed.to_string()
    }
}

fn validate_segment(segment: &TicketSegmentPayload, index: usize) -> Result<(), String> {
    let label = if index == 0 {
        "primary segment".to_string()
    } else {
        format!("segment {}", index + 1)
    };

    if segment.carrier_name.trim().is_empty() {
        return Err(format!("Carrier name is required for {}.", label));
    }
    if segment.code.trim().is_empty() {
        return Err(format!("Flight or train number is required for {}.", label));
    }
    if segment.departure.name.trim().is_empty() || segment.arrival.name.trim().is_empty() {
        return Err(format!("Departure and arrival names are required for {}.", label));
    }
    if segment.departure.timezone.trim().is_empty() || segment.arrival.timezone.trim().is_empty() {
        return Err(format!("Departure and arrival timezones are required for {}.", label));
    }

    normalize_to_utc(&segment.departure_time_local, &segment.departure.timezone)?;
    normalize_to_utc(&segment.arrival_time_local, &segment.arrival.timezone)?;

    Ok(())
}

fn validate_draft(draft: &TicketDraftPayload) -> Result<(), String> {
    validate_segment(
        &TicketSegmentPayload {
            carrier_name: draft.carrier_name.clone(),
            code: draft.code.clone(),
            departure: draft.departure.clone(),
            arrival: draft.arrival.clone(),
            departure_terminal: draft.departure_terminal.clone(),
            arrival_terminal: draft.arrival_terminal.clone(),
            departure_time_local: draft.departure_time_local.clone(),
            arrival_time_local: draft.arrival_time_local.clone(),
            class_info: draft.class_info.clone(),
            seat_info: draft.seat_info.clone(),
            notes: draft.notes.clone(),
        },
        0,
    )?;

    for (index, segment) in (draft.segments.as_ref().map(|items| items.iter()).into_iter().flatten()).enumerate() {
        validate_segment(segment, index + 1)?;
    }

    Ok(())
}

fn validate_status(status: &str) -> Result<(), String> {
    match status {
        "saved" | "used" | "archived" => Ok(()),
        _ => Err(format!("Unsupported ticket status: {}", status)),
    }
}

fn normalize_journey_mutation(
    conn: &Connection,
    input: JourneyMutationPayload,
) -> Result<NormalizedJourneyMutation, String> {
    let title = input.title.trim().to_string();
    if title.is_empty() {
        return Err("Journey title is required.".to_string());
    }

    let date_mode = input.date_mode.trim().to_lowercase();
    if date_mode != "auto" && date_mode != "manual" {
        return Err("Journey date mode must be either auto or manual.".to_string());
    }

    if let Some(rating) = input.rating {
        if !(1..=5).contains(&rating) {
            return Err("Journey rating must be between 1 and 5.".to_string());
        }
    }

    if let Some(cost_amount) = input.cost_amount {
        if !cost_amount.is_finite() || cost_amount < 0.0 {
            return Err("Journey cost amount must be a non-negative number.".to_string());
        }
    }

    let ticket_records = load_linked_journey_ticket_records(conn, &input.ticket_ids)?;
    let normalized_ticket_ids = ticket_records
        .iter()
        .map(|record| record.ticket_id.clone())
        .collect::<Vec<_>>();
    let (start_date, end_date) = if date_mode == "auto" {
        derive_journey_date_range_from_linked_tickets(&ticket_records)
    } else {
        let start_date = normalize_optional_date(input.start_date)?;
        let end_date = normalize_optional_date(input.end_date)?;
        validate_date_range(start_date.as_deref(), end_date.as_deref())?;
        (start_date, end_date)
    };

    Ok(NormalizedJourneyMutation {
        title,
        destination: normalize_optional_text(input.destination),
        date_mode,
        start_date,
        end_date,
        notes: normalize_optional_text(input.notes),
        rating: input.rating,
        mood: normalize_optional_text(input.mood),
        cost_amount: input.cost_amount,
        cost_currency: normalize_optional_text(input.cost_currency).map(|value| value.to_uppercase()),
        lodging: normalize_optional_text(input.lodging),
        companion_names: normalize_companion_names(input.companion_names),
        ticket_ids: normalized_ticket_ids,
    })
}

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
}

fn normalize_optional_date(value: Option<String>) -> Result<Option<String>, String> {
    let Some(trimmed) = normalize_optional_text(value) else {
        return Ok(None);
    };

    NaiveDate::parse_from_str(&trimmed, "%Y-%m-%d")
        .map_err(|_| format!("Journey dates must use YYYY-MM-DD, received {}.", trimmed))?;
    Ok(Some(trimmed))
}

fn validate_date_range(start_date: Option<&str>, end_date: Option<&str>) -> Result<(), String> {
    if let (Some(start_date), Some(end_date)) = (start_date, end_date) {
        if start_date > end_date {
            return Err("Journey start date cannot be later than end date.".to_string());
        }
    }

    Ok(())
}

fn normalize_companion_names(values: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();

    for value in values {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            continue;
        }

        let dedupe_key = trimmed.to_lowercase();
        if seen.insert(dedupe_key) {
            normalized.push(trimmed.to_string());
        }
    }

    normalized
}

fn load_linked_journey_ticket_records(
    conn: &Connection,
    ticket_ids: &[String],
) -> Result<Vec<LinkedJourneyTicketRecord>, String> {
    let mut seen = HashSet::new();
    let mut records = Vec::new();

    for ticket_id in ticket_ids {
        let trimmed = ticket_id.trim();
        if trimmed.is_empty() || !seen.insert(trimmed.to_string()) {
            continue;
        }

        let ticket_row = get_ticket_row(conn, trimmed)?;
        let draft = deserialize_ticket_draft(&ticket_row.raw_payload_json)?;
        let effective_segments = build_effective_segments(&draft);
        let first_segment = effective_segments.first();
        let last_segment = effective_segments.last();
        let start_date = first_segment
            .and_then(|segment| extract_date_portion(&segment.departure_time_local));
        let end_date = last_segment
            .and_then(|segment| extract_date_portion(&segment.arrival_time_local))
            .or_else(|| {
                last_segment.and_then(|segment| extract_date_portion(&segment.departure_time_local))
            });

        records.push(LinkedJourneyTicketRecord {
            ticket_id: trimmed.to_string(),
            start_date,
            end_date,
            created_at: ticket_row.created_at,
        });
    }

    sort_linked_journey_ticket_records(&mut records);
    Ok(records)
}

fn derive_journey_date_range_from_linked_tickets(
    ticket_records: &[LinkedJourneyTicketRecord],
) -> (Option<String>, Option<String>) {
    let start_date = ticket_records
        .iter()
        .filter_map(|record| record.start_date.as_deref())
        .min()
        .map(str::to_string);
    let end_date = ticket_records
        .iter()
        .filter_map(|record| record.end_date.as_deref().or(record.start_date.as_deref()))
        .max()
        .map(str::to_string);

    (start_date, end_date)
}

fn sort_linked_journey_ticket_records(ticket_records: &mut [LinkedJourneyTicketRecord]) {
    ticket_records.sort_by(|left, right| {
        compare_optional_date(left.start_date.as_deref(), right.start_date.as_deref())
            .then(compare_optional_date(left.end_date.as_deref(), right.end_date.as_deref()))
            .then(left.created_at.cmp(&right.created_at))
            .then(left.ticket_id.cmp(&right.ticket_id))
    });
}

fn compare_optional_date(left: Option<&str>, right: Option<&str>) -> Ordering {
    match (left, right) {
        (Some(left), Some(right)) => left.cmp(right),
        (Some(_), None) => Ordering::Less,
        (None, Some(_)) => Ordering::Greater,
        (None, None) => Ordering::Equal,
    }
}

fn extract_date_portion(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.len() < 10 {
        return None;
    }

    let date = &trimmed[..10];
    NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .ok()
        .map(|_| date.to_string())
}

fn replace_journey_ticket_links(
    conn: &Connection,
    journey_id: &str,
    ticket_ids: &[String],
    created_at: &str,
) -> Result<(), String> {
    conn.execute("DELETE FROM journey_tickets WHERE journey_id = ?1", [journey_id])
        .map_err(|err| err.to_string())?;

    for ticket_id in ticket_ids {
        conn.execute(
            "INSERT INTO journey_tickets (id, journey_id, ticket_id, created_at)
             VALUES (?1, ?2, ?3, ?4)",
            params![Uuid::new_v4().to_string(), journey_id, ticket_id, created_at],
        )
        .map_err(|err| err.to_string())?;
    }

    Ok(())
}

fn replace_journey_companions(
    conn: &Connection,
    journey_id: &str,
    companion_names: &[String],
    created_at: &str,
) -> Result<(), String> {
    conn.execute("DELETE FROM journey_companions WHERE journey_id = ?1", [journey_id])
        .map_err(|err| err.to_string())?;

    for companion_name in companion_names {
        conn.execute(
            "INSERT INTO journey_companions (id, journey_id, name, created_at)
             VALUES (?1, ?2, ?3, ?4)",
            params![Uuid::new_v4().to_string(), journey_id, companion_name, created_at],
        )
        .map_err(|err| err.to_string())?;
    }

    Ok(())
}

fn build_segment_metadata(segment: &TicketSegmentPayload) -> String {
    serde_json::json!({
        "notes": segment.notes,
        "departureCode": segment.departure.code,
        "arrivalCode": segment.arrival.code,
        "departureTerminal": segment.departure_terminal,
        "arrivalTerminal": segment.arrival_terminal
    })
    .to_string()
}

fn deserialize_ticket_draft(raw_payload_json: &str) -> Result<TicketDraftPayload, String> {
    serde_json::from_str(raw_payload_json).map_err(|err| err.to_string())
}

fn parse_ticket_row(row: &Row<'_>) -> rusqlite::Result<TicketRowData> {
    Ok(TicketRowData {
        id: row.get(0)?,
        ticket_type: row.get(1)?,
        carrier_name: row.get(2)?,
        code: row.get(3)?,
        raw_payload_json: row.get(4)?,
        normalized_status: row.get(5)?,
        journey_id: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

fn parse_journey_row(row: &Row<'_>) -> rusqlite::Result<JourneyRowData> {
    Ok(JourneyRowData {
        id: row.get(0)?,
        title: row.get(1)?,
        destination: row.get(2)?,
        date_mode: row.get(3)?,
        start_date: row.get(4)?,
        end_date: row.get(5)?,
        notes: row.get(6)?,
        rating: row.get(7)?,
        mood: row.get(8)?,
        cost_amount: row.get(9)?,
        cost_currency: row.get(10)?,
        lodging: row.get(11)?,
        created_at: row.get(12)?,
        updated_at: row.get(13)?,
    })
}

fn parse_attachment_row(row: &Row<'_>) -> rusqlite::Result<AttachmentRowData> {
    Ok(AttachmentRowData {
        id: row.get(0)?,
        ticket_id: row.get(1)?,
        file_name: row.get(2)?,
        mime_type: row.get(3)?,
        file_size: row.get(4)?,
        file_path: row.get(5)?,
        created_at: row.get(6)?,
    })
}

fn ticket_row_to_record(row: TicketRowData) -> rusqlite::Result<TicketRecordPayload> {
    let draft = serde_json::from_str::<TicketDraftPayload>(&row.raw_payload_json).map_err(|err| {
        rusqlite::Error::FromSqlConversionFailure(
            row.raw_payload_json.len(),
            rusqlite::types::Type::Text,
            Box::new(err),
        )
    })?;

    Ok(build_ticket_record(
        row.id,
        row.ticket_type,
        row.carrier_name,
        row.code,
        draft,
        row.normalized_status,
        row.created_at,
        row.updated_at,
    ))
}

fn journey_row_to_payload(conn: &Connection, row: JourneyRowData) -> Result<JourneyPayload, String> {
    Ok(JourneyPayload {
        id: row.id.clone(),
        title: row.title,
        destination: row.destination,
        date_mode: row.date_mode,
        start_date: row.start_date,
        end_date: row.end_date,
        notes: row.notes,
        rating: row.rating,
        mood: row.mood,
        cost_amount: row.cost_amount,
        cost_currency: row.cost_currency,
        lodging: row.lodging,
        companions: load_journey_companions(conn, &row.id)?,
        ticket_ids: load_journey_ticket_ids(conn, &row.id)?,
        created_at: row.created_at,
        updated_at: row.updated_at,
    })
}

fn attachment_row_to_payload(row: AttachmentRowData) -> Result<TicketAttachmentPayload, String> {
    Ok(TicketAttachmentPayload {
        id: row.id,
        ticket_id: row.ticket_id,
        file_name: row.file_name,
        mime_type: row.mime_type,
        file_size: row.file_size.max(0) as u64,
        created_at: row.created_at,
        file_path: row.file_path,
    })
}

fn get_ticket_row(conn: &Connection, ticket_id: &str) -> Result<TicketRowData, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, ticket_type, carrier_name, code, raw_payload_json, normalized_status, journey_id, created_at_utc, updated_at_utc
             FROM ticket_records
             WHERE id = ?1",
        )
        .map_err(|err| err.to_string())?;

    stmt.query_row([ticket_id], parse_ticket_row)
        .map_err(|err| err.to_string())
}

fn get_journey_row(conn: &Connection, journey_id: &str) -> Result<JourneyRowData, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, title, destination, date_mode, start_date, end_date, notes,
                    rating, mood, cost_amount, cost_currency, lodging, created_at, updated_at
             FROM journeys
             WHERE id = ?1",
        )
        .map_err(|err| err.to_string())?;

    stmt.query_row([journey_id], parse_journey_row)
        .map_err(|err| err.to_string())
}

fn get_attachment_row(conn: &Connection, attachment_id: &str) -> Result<AttachmentRowData, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, ticket_id, file_name, mime_type, file_size, file_path, created_at_utc
             FROM ticket_attachments
             WHERE id = ?1",
        )
        .map_err(|err| err.to_string())?;

    stmt.query_row([attachment_id], parse_attachment_row)
        .map_err(|err| err.to_string())
}

fn list_ticket_attachments(
    conn: &Connection,
    ticket_id: &str,
) -> Result<Vec<TicketAttachmentPayload>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, ticket_id, file_name, mime_type, file_size, file_path, created_at_utc
             FROM ticket_attachments
             WHERE ticket_id = ?1
             ORDER BY created_at_utc DESC",
        )
        .map_err(|err| err.to_string())?;

    let rows = stmt
        .query_map([ticket_id], parse_attachment_row)
        .map_err(|err| err.to_string())?;

    rows.map(|row| row.map_err(|err| err.to_string()).and_then(attachment_row_to_payload))
        .collect()
}

fn load_journey_companions(
    conn: &Connection,
    journey_id: &str,
) -> Result<Vec<JourneyCompanionPayload>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, journey_id, name, created_at
             FROM journey_companions
             WHERE journey_id = ?1
             ORDER BY created_at ASC, id ASC",
        )
        .map_err(|err| err.to_string())?;

    let rows = stmt
        .query_map([journey_id], |row| {
            Ok(JourneyCompanionPayload {
                id: row.get(0)?,
                journey_id: row.get(1)?,
                name: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|err| err.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())
}

fn load_journey_ticket_ids(conn: &Connection, journey_id: &str) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT ticket_id, created_at
             FROM journey_tickets
             WHERE journey_id = ?1",
        )
        .map_err(|err| err.to_string())?;

    let rows = stmt
        .query_map([journey_id], |row| {
            Ok(LinkedJourneyTicketRecord {
                ticket_id: row.get(0)?,
                start_date: None,
                end_date: None,
                created_at: row.get(1)?,
            })
        })
        .map_err(|err| err.to_string())?;

    let raw_records = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;
    let mut linked_ticket_records = raw_records
        .into_iter()
        .map(|record| hydrate_linked_journey_ticket_record(conn, record))
        .collect::<Result<Vec<_>, _>>()?;
    sort_linked_journey_ticket_records(&mut linked_ticket_records);

    Ok(linked_ticket_records
        .into_iter()
        .map(|record| record.ticket_id)
        .collect())
}

fn hydrate_linked_journey_ticket_record(
    conn: &Connection,
    mut record: LinkedJourneyTicketRecord,
) -> Result<LinkedJourneyTicketRecord, String> {
    if let Ok(ticket_row) = get_ticket_row(conn, &record.ticket_id) {
        let draft = deserialize_ticket_draft(&ticket_row.raw_payload_json)?;
        let effective_segments = build_effective_segments(&draft);
        let first_segment = effective_segments.first();
        let last_segment = effective_segments.last();
        record.start_date = first_segment
            .and_then(|segment| extract_date_portion(&segment.departure_time_local));
        record.end_date = last_segment
            .and_then(|segment| extract_date_portion(&segment.arrival_time_local))
            .or_else(|| {
                last_segment.and_then(|segment| extract_date_portion(&segment.departure_time_local))
            });
    }

    Ok(record)
}

fn touch_ticket_updated_at(conn: &Connection, ticket_id: &str, updated_at: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE ticket_records
         SET updated_at_utc = ?1,
             version = version + 1
         WHERE id = ?2",
        params![updated_at, ticket_id],
    )
    .map_err(|err| err.to_string())?;
    Ok(())
}

fn sanitize_file_name(file_name: &str) -> String {
    let sanitized = file_name
        .chars()
        .map(|char| match char {
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => char,
        })
        .collect::<String>()
        .trim()
        .to_string();

    if sanitized.is_empty() {
        "attachment.bin".to_string()
    } else {
        sanitized
    }
}

fn build_stored_file_name(attachment_id: &str, file_name: &str) -> String {
    let extension = Path::new(file_name)
        .extension()
        .and_then(OsStr::to_str)
        .map(|ext| format!(".{}", ext))
        .unwrap_or_default();

    format!("{}{}", attachment_id, extension)
}

fn journey_status_for_ticket_status(status: &str) -> &str {
    match status {
        "used" => "completed",
        "archived" => "archived",
        _ => "planned",
    }
}

fn normalize_to_utc(value: &str, timezone: &str) -> Result<String, String> {
    let naive = NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M")
        .map_err(|_| format!("Invalid datetime format: {}", value))?;
    let tz: Tz = timezone
        .parse()
        .map_err(|_| format!("Invalid timezone: {}", timezone))?;

    let localized = match tz.from_local_datetime(&naive) {
        LocalResult::Single(time) => time,
        LocalResult::Ambiguous(earliest, _) => earliest,
        LocalResult::None => return Err(format!("Could not resolve local time {} in {}", value, timezone)),
    };

    Ok(localized.with_timezone(&Utc).to_rfc3339())
}

fn open_connection(app: &AppHandle) -> Result<Connection, String> {
    let path = database_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }

    let conn = Connection::open(path).map_err(|err| err.to_string())?;
    migrate_legacy_ticket_journey_tables(&conn)?;
    conn.execute_batch(SCHEMA_SQL).map_err(|err| err.to_string())?;
    seed_airlines(&conn)?;
    seed_location_directory(&conn)?;
    Ok(conn)
}

fn migrate_legacy_ticket_journey_tables(conn: &Connection) -> Result<(), String> {
    if !table_exists(conn, LEGACY_JOURNEYS_TABLE)? {
        return Ok(());
    }

    if !table_has_column(conn, LEGACY_JOURNEYS_TABLE, "journey_type")?
        || !table_has_column(conn, LEGACY_JOURNEYS_TABLE, "start_time_utc")?
    {
        return Ok(());
    }

    conn.execute_batch("BEGIN IMMEDIATE TRANSACTION;")
        .map_err(|err| err.to_string())?;

    let result = (|| {
        conn.execute("DROP INDEX IF EXISTS idx_journeys_status_start", [])
            .map_err(|err| err.to_string())?;
        conn.execute("DROP INDEX IF EXISTS idx_segments_departure_utc", [])
            .map_err(|err| err.to_string())?;
        conn.execute("DROP INDEX IF EXISTS idx_segments_route", [])
            .map_err(|err| err.to_string())?;

        if table_exists(conn, TICKET_ITINERARIES_TABLE)? {
            if table_exists(conn, LEGACY_SEGMENTS_TABLE)? {
                if table_exists(conn, TICKET_SEGMENTS_TABLE)? {
                    conn.execute("DROP TABLE segments", [])
                        .map_err(|err| err.to_string())?;
                } else {
                    conn.execute("ALTER TABLE segments RENAME TO ticket_segments", [])
                        .map_err(|err| err.to_string())?;
                }
            }

            conn.execute("DROP TABLE journeys", [])
                .map_err(|err| err.to_string())?;
        } else {
            conn.execute(
                "ALTER TABLE journeys RENAME TO ticket_itineraries",
                [],
            )
            .map_err(|err| err.to_string())?;

            if table_exists(conn, LEGACY_SEGMENTS_TABLE)? && !table_exists(conn, TICKET_SEGMENTS_TABLE)? {
                conn.execute(
                    "ALTER TABLE segments RENAME TO ticket_segments",
                    [],
                )
                .map_err(|err| err.to_string())?;
            }
        }

        conn.execute_batch("COMMIT;").map_err(|err| err.to_string())
    })();

    if result.is_err() {
        let _ = conn.execute_batch("ROLLBACK;");
    }

    result
}

fn table_exists(conn: &Connection, table_name: &str) -> Result<bool, String> {
    conn.query_row(
        "SELECT EXISTS(
            SELECT 1
            FROM sqlite_master
            WHERE type = 'table' AND name = ?1
        )",
        [table_name],
        |row| row.get::<_, i64>(0),
    )
    .map(|value| value != 0)
    .map_err(|err| err.to_string())
}

fn table_has_column(conn: &Connection, table_name: &str, column_name: &str) -> Result<bool, String> {
    let pragma = format!("PRAGMA table_info({})", table_name);
    let mut stmt = conn.prepare(&pragma).map_err(|err| err.to_string())?;
    let columns = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|err| err.to_string())?;

    for column in columns {
        if column.map_err(|err| err.to_string())? == column_name {
            return Ok(true);
        }
    }

    Ok(false)
}

fn seed_airlines(conn: &Connection) -> Result<(), String> {
    let seeds: Vec<AirlineSeedEntry> = serde_json::from_str(AIRLINES_SEED_JSON).map_err(|err| err.to_string())?;
    let now = Utc::now().to_rfc3339();

    conn.execute_batch("BEGIN IMMEDIATE TRANSACTION;")
        .map_err(|err| err.to_string())?;

    let result = (|| {
        for entry in seeds {
            let aliases_json = serde_json::to_string(&entry.aliases).map_err(|err| err.to_string())?;
            let id = format!("airline-{}", entry.iata_code.to_lowercase());

            conn.execute(
                "INSERT INTO airlines (
                    id, iata_code, icao_code, name_en, name_zh, aliases_json,
                    country_code, logo_key, created_at_utc, updated_at_utc
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                 ON CONFLICT(iata_code) DO UPDATE SET
                    icao_code = excluded.icao_code,
                    name_en = excluded.name_en,
                    name_zh = excluded.name_zh,
                    aliases_json = excluded.aliases_json,
                    country_code = excluded.country_code,
                    logo_key = excluded.logo_key,
                    updated_at_utc = excluded.updated_at_utc",
                params![
                    &id,
                    &entry.iata_code,
                    &entry.icao_code,
                    &entry.name_en,
                    &entry.name_zh,
                    &aliases_json,
                    &entry.country_code,
                    &entry.logo_key,
                    &now,
                    &now
                ],
            )
            .map_err(|err| err.to_string())?;
        }

        conn.execute_batch("COMMIT;").map_err(|err| err.to_string())
    })();

    if result.is_err() {
        let _ = conn.execute_batch("ROLLBACK;");
    }

    result
}

fn seed_location_directory(conn: &Connection) -> Result<(), String> {
    let seeds: Vec<LocationSeedEntry> =
        serde_json::from_str(LOCATIONS_SEED_JSON).map_err(|err| err.to_string())?;
    let now = Utc::now().to_rfc3339();

    conn.execute_batch("BEGIN IMMEDIATE TRANSACTION;")
        .map_err(|err| err.to_string())?;

    let result = (|| {
        for entry in seeds {
            let aliases_json = serde_json::to_string(&entry.aliases).map_err(|err| err.to_string())?;

            conn.execute(
                "INSERT INTO location_directory (
                    id, location_type, code, name_zh, name_en, aliases_json,
                    latitude, longitude, timezone, country_code, created_at_utc, updated_at_utc
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
                 ON CONFLICT(id) DO UPDATE SET
                    location_type = excluded.location_type,
                    code = excluded.code,
                    name_zh = excluded.name_zh,
                    name_en = excluded.name_en,
                    aliases_json = excluded.aliases_json,
                    latitude = excluded.latitude,
                    longitude = excluded.longitude,
                    timezone = excluded.timezone,
                    country_code = excluded.country_code,
                    updated_at_utc = excluded.updated_at_utc",
                params![
                    &entry.id,
                    &entry.location_type,
                    &entry.code,
                    &entry.name_zh,
                    &entry.name_en,
                    &aliases_json,
                    &entry.latitude,
                    &entry.longitude,
                    &entry.timezone,
                    &entry.country_code,
                    &now,
                    &now
                ],
            )
            .map_err(|err| err.to_string())?;
        }

        conn.execute_batch("COMMIT;").map_err(|err| err.to_string())
    })();

    if result.is_err() {
        let _ = conn.execute_batch("ROLLBACK;");
    }

    result
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
    Ok(data_dir.join("tickettrail.sqlite3"))
}

fn attachment_root_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
    Ok(data_dir.join("attachments"))
}

fn backup_root_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
    Ok(data_dir.join("backups"))
}

fn export_root_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let path_service = app.path();
    let base_dir = path_service
        .download_dir()
        .or_else(|_| path_service.desktop_dir())
        .or_else(|_| path_service.document_dir())
        .unwrap_or_else(|_| path_service.app_data_dir().unwrap_or_else(|_| PathBuf::from(".")));
    Ok(base_dir.join("TicketTrail Backups"))
}

fn attachment_ticket_dir(app: &AppHandle, ticket_id: &str) -> Result<PathBuf, String> {
    Ok(attachment_root_dir(app)?.join(ticket_id))
}

fn count_attachments(conn: &Connection) -> Result<usize, String> {
    conn.query_row("SELECT COUNT(*) FROM ticket_attachments", [], |row| row.get::<_, i64>(0))
        .map(|count| count.max(0) as usize)
        .map_err(|err| err.to_string())
}

fn copy_dir_recursive(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination).map_err(|err| err.to_string())?;

    for entry in fs::read_dir(source).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let file_type = entry.file_type().map_err(|err| err.to_string())?;
        let next_destination = destination.join(entry.file_name());

        if file_type.is_dir() {
            copy_dir_recursive(&entry.path(), &next_destination)?;
        } else {
            fs::copy(entry.path(), next_destination).map_err(|err| err.to_string())?;
        }
    }

    Ok(())
}

fn compress_directory_to_zip(source: &Path, destination: &Path) -> Result<(), String> {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "param([string]$Source,[string]$Destination) Compress-Archive -LiteralPath $Source -DestinationPath $Destination -Force",
        ])
        .arg(source.to_string_lossy().to_string())
        .arg(destination.to_string_lossy().to_string())
        .output()
        .map_err(|err| err.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if stderr.is_empty() {
            "Failed to compress archive bundle.".to_string()
        } else {
            stderr
        })
    }
}

fn expand_zip_to_directory(source: &Path, destination: &Path) -> Result<(), String> {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "param([string]$Source,[string]$Destination) Expand-Archive -LiteralPath $Source -DestinationPath $Destination -Force",
        ])
        .arg(source.to_string_lossy().to_string())
        .arg(destination.to_string_lossy().to_string())
        .output()
        .map_err(|err| err.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if stderr.is_empty() {
            "Failed to expand archive bundle.".to_string()
        } else {
            stderr
        })
    }
}

fn locate_backup_dir(import_root: &Path) -> Result<PathBuf, String> {
    let direct_manifest = import_root.join("backup.json");
    if direct_manifest.exists() {
        return Ok(import_root.to_path_buf());
    }

    for entry in fs::read_dir(import_root).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        if entry.file_type().map_err(|err| err.to_string())?.is_dir() {
            let candidate = entry.path();
            if candidate.join("backup.json").exists() {
                return Ok(candidate);
            }
        }
    }

    Err("Could not locate a valid backup manifest inside the archive bundle.".to_string())
}

fn restore_from_backup_dir(app: &AppHandle, backup_dir: &Path) -> Result<(), String> {
    let backup_db = backup_dir.join("tickettrail.sqlite3");
    if !backup_db.exists() {
        return Err(format!(
            "Backup database was not found in {}.",
            backup_dir.to_string_lossy()
        ));
    }

    let target_db = database_path(app)?;
    if let Some(parent) = target_db.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    fs::copy(&backup_db, &target_db).map_err(|err| err.to_string())?;

    let target_attachments = attachment_root_dir(app)?;
    if target_attachments.exists() {
        fs::remove_dir_all(&target_attachments).map_err(|err| err.to_string())?;
    }

    let backup_attachments = backup_dir.join("attachments");
    if backup_attachments.exists() {
        copy_dir_recursive(&backup_attachments, &target_attachments)?;
    } else {
        fs::create_dir_all(&target_attachments).map_err(|err| err.to_string())?;
    }

    let _ = open_connection(app)?;
    Ok(())
}

fn resolve_map_point(conn: &Connection, location: &TicketLocationPayload) -> MapPointPayload {
    let (latitude, longitude) = resolve_coordinates(conn, location);

    MapPointPayload {
        label: location.name.clone(),
        code: location.code.clone(),
        timezone: location.timezone.clone(),
        latitude,
        longitude,
    }
}

fn resolve_coordinates(conn: &Connection, location: &TicketLocationPayload) -> (f64, f64) {
    if let Some((latitude, longitude)) = lookup_coordinates(conn, location) {
        return (latitude, longitude);
    }

    let code = location.code.as_deref().unwrap_or("").to_uppercase();
    let name = location.name.to_lowercase();

    if code == "PVG" || name.contains("pudong") {
        return (31.1443, 121.8083);
    }
    if code == "SHA" || name.contains("hongqiao airport") {
        return (31.1979, 121.3363);
    }
    if code == "SYD" || name.contains("sydney") {
        return (-33.9399, 151.1753);
    }
    if code == "SHH" || name.contains("hongqiao") {
        return (31.1971, 121.3270);
    }
    if code == "NKH" || name.contains("nanjing south") {
        return (31.9680, 118.8060);
    }
    if name.contains("shanghai") {
        return (31.2304, 121.4737);
    }

    let seed_source = if code.is_empty() { location.name.as_str() } else { code.as_str() };
    fallback_coordinates(seed_source)
}

fn fallback_coordinates(seed_source: &str) -> (f64, f64) {
    let seed = seed_source
        .bytes()
        .fold(0_u64, |acc, value| acc.wrapping_mul(131).wrapping_add(value as u64));

    let latitude = ((seed % 12000) as f64 / 100.0) - 60.0;
    let longitude = (((seed / 97) % 34000) as f64 / 100.0) - 170.0;
    (latitude, longitude)
}

#[cfg(test)]
mod tests {
    use super::{
        build_effective_segments, compare_optional_date, derive_journey_date_range_from_linked_tickets,
        migrate_legacy_ticket_journey_tables, normalize_companion_names, normalize_to_utc,
        sanitize_file_name, sort_linked_journey_ticket_records, table_exists, validate_draft,
        LinkedJourneyTicketRecord, TicketDraftPayload, TicketLocationPayload, TicketSegmentPayload,
    };
    use rusqlite::Connection;

    fn sample_location(name: &str, code: Option<&str>, timezone: &str) -> TicketLocationPayload {
        TicketLocationPayload {
            name: name.to_string(),
            code: code.map(|value| value.to_string()),
            timezone: timezone.to_string(),
        }
    }

    fn sample_draft() -> TicketDraftPayload {
        TicketDraftPayload {
            ticket_type: "flight".to_string(),
            carrier_name: "China Eastern".to_string(),
            code: "MU561".to_string(),
            departure: sample_location("Shanghai Pudong", Some("PVG"), "Asia/Shanghai"),
            arrival: sample_location("Sydney", Some("SYD"), "Australia/Sydney"),
            departure_terminal: Some("T1".to_string()),
            arrival_terminal: Some("T3".to_string()),
            departure_time_local: "2026-05-21T09:30".to_string(),
            arrival_time_local: "2026-05-21T21:30".to_string(),
            class_info: "Economy".to_string(),
            seat_info: "24A".to_string(),
            notes: "".to_string(),
            segments: Some(vec![TicketSegmentPayload {
                carrier_name: "China Eastern".to_string(),
                code: "MU562".to_string(),
                departure: sample_location("Sydney", Some("SYD"), "Australia/Sydney"),
                arrival: sample_location("Melbourne", Some("MEL"), "Australia/Melbourne"),
                departure_terminal: Some("T2".to_string()),
                arrival_terminal: Some("T4".to_string()),
                departure_time_local: "2026-05-22T08:00".to_string(),
                arrival_time_local: "2026-05-22T09:35".to_string(),
                class_info: "Economy".to_string(),
                seat_info: "11C".to_string(),
                notes: "".to_string(),
            }]),
        }
    }

    fn create_legacy_ticket_journey_connection() -> Connection {
        let conn = Connection::open_in_memory().expect("should create in-memory db");
        conn.execute_batch(
            "
            CREATE TABLE journeys (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                journey_type TEXT NOT NULL,
                primary_ticket_type TEXT NOT NULL,
                status TEXT NOT NULL,
                start_time_utc TEXT NOT NULL,
                end_time_utc TEXT NOT NULL,
                created_at_utc TEXT NOT NULL,
                updated_at_utc TEXT NOT NULL
            );
            CREATE TABLE segments (
                id TEXT PRIMARY KEY,
                journey_id TEXT NOT NULL,
                segment_index INTEGER NOT NULL,
                transport_type TEXT NOT NULL,
                carrier_name TEXT NOT NULL,
                code TEXT NOT NULL,
                departure_location_id TEXT,
                arrival_location_id TEXT,
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
            CREATE INDEX idx_journeys_status_start ON journeys(status, start_time_utc);
            CREATE INDEX idx_segments_departure_utc ON segments(departure_time_utc);
            CREATE INDEX idx_segments_route ON segments(departure_location_id, arrival_location_id);
            ",
        )
        .expect("should create legacy tables");
        conn
    }

    #[test]
    fn normalize_to_utc_converts_local_time() {
        let value = normalize_to_utc("2026-05-21T09:30", "Asia/Shanghai").expect("should convert");
        assert!(value.starts_with("2026-05-21T01:30:00"));
    }

    #[test]
    fn sanitize_file_name_replaces_invalid_characters() {
        let sanitized = sanitize_file_name("boa:rd*ing?/pass<>.png");
        assert_eq!(sanitized, "boa_rd_ing__pass__.png");
    }

    #[test]
    fn validate_draft_accepts_well_formed_multi_segment_ticket() {
        let draft = sample_draft();
        assert!(validate_draft(&draft).is_ok());
    }

    #[test]
    fn validate_draft_rejects_missing_timezone() {
        let mut draft = sample_draft();
        draft.departure.timezone = "".to_string();
        let result = validate_draft(&draft);
        assert!(result.is_err());
    }

    #[test]
    fn build_effective_segments_does_not_duplicate_first_leg_for_complete_segment_lists() {
        let mut draft = sample_draft();
        draft.segments = Some(vec![
            TicketSegmentPayload {
                carrier_name: "China Eastern".to_string(),
                code: "MU561".to_string(),
                departure: sample_location("Shanghai Pudong", Some("PVG"), "Asia/Shanghai"),
                arrival: sample_location("Sydney", Some("SYD"), "Australia/Sydney"),
                departure_terminal: Some("T1".to_string()),
                arrival_terminal: Some("T3".to_string()),
                departure_time_local: "2026-05-21T09:30".to_string(),
                arrival_time_local: "2026-05-21T21:30".to_string(),
                class_info: "Economy".to_string(),
                seat_info: "24A".to_string(),
                notes: "".to_string(),
            },
            TicketSegmentPayload {
                carrier_name: "China Eastern".to_string(),
                code: "MU562".to_string(),
                departure: sample_location("Sydney", Some("SYD"), "Australia/Sydney"),
                arrival: sample_location("Melbourne", Some("MEL"), "Australia/Melbourne"),
                departure_terminal: Some("T2".to_string()),
                arrival_terminal: Some("T4".to_string()),
                departure_time_local: "2026-05-22T08:00".to_string(),
                arrival_time_local: "2026-05-22T09:35".to_string(),
                class_info: "Economy".to_string(),
                seat_info: "11C".to_string(),
                notes: "".to_string(),
            },
        ]);

        let segments = build_effective_segments(&draft);
        assert_eq!(segments.len(), 2);
        assert_eq!(segments[0].departure.code.as_deref(), Some("PVG"));
        assert_eq!(segments[1].arrival.code.as_deref(), Some("MEL"));
    }

    #[test]
    fn migrate_legacy_ticket_journey_tables_renames_old_tables() {
        let conn = create_legacy_ticket_journey_connection();

        migrate_legacy_ticket_journey_tables(&conn).expect("legacy table migration should succeed");

        assert!(table_exists(&conn, "ticket_itineraries").expect("should inspect tables"));
        assert!(table_exists(&conn, "ticket_segments").expect("should inspect tables"));
        assert!(!table_exists(&conn, "journeys").expect("should inspect tables"));
        assert!(!table_exists(&conn, "segments").expect("should inspect tables"));
    }

    #[test]
    fn migrate_legacy_ticket_journey_tables_is_noop_without_legacy_tables() {
        let conn = Connection::open_in_memory().expect("should create in-memory db");

        migrate_legacy_ticket_journey_tables(&conn).expect("migration should be a no-op");

        assert!(!table_exists(&conn, "ticket_itineraries").expect("should inspect tables"));
        assert!(!table_exists(&conn, "journeys").expect("should inspect tables"));
    }

    #[test]
    fn migrate_legacy_ticket_journey_tables_cleans_up_mixed_partial_state() {
        let conn = create_legacy_ticket_journey_connection();
        conn.execute_batch(
            "
            CREATE TABLE ticket_itineraries (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                journey_type TEXT NOT NULL,
                primary_ticket_type TEXT NOT NULL,
                status TEXT NOT NULL,
                start_time_utc TEXT NOT NULL,
                end_time_utc TEXT NOT NULL,
                created_at_utc TEXT NOT NULL,
                updated_at_utc TEXT NOT NULL
            );
            CREATE TABLE ticket_segments (
                id TEXT PRIMARY KEY,
                journey_id TEXT NOT NULL,
                segment_index INTEGER NOT NULL,
                transport_type TEXT NOT NULL,
                carrier_name TEXT NOT NULL,
                code TEXT NOT NULL,
                departure_location_id TEXT,
                arrival_location_id TEXT,
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
            ",
        )
        .expect("should create mixed state");

        migrate_legacy_ticket_journey_tables(&conn).expect("mixed migration should succeed");

        assert!(table_exists(&conn, "ticket_itineraries").expect("should inspect tables"));
        assert!(table_exists(&conn, "ticket_segments").expect("should inspect tables"));
        assert!(!table_exists(&conn, "journeys").expect("should inspect tables"));
        assert!(!table_exists(&conn, "segments").expect("should inspect tables"));
    }

    #[test]
    fn normalize_companion_names_trims_dedupes_and_ignores_empty_values() {
        let companions = normalize_companion_names(vec![
            " Alice ".to_string(),
            "".to_string(),
            "alice".to_string(),
            "Bob".to_string(),
            "  Bob  ".to_string(),
        ]);

        assert_eq!(companions, vec!["Alice".to_string(), "Bob".to_string()]);
    }

    #[test]
    fn linked_ticket_records_sort_and_derive_auto_dates() {
        let mut records = vec![
            LinkedJourneyTicketRecord {
                ticket_id: "late".to_string(),
                start_date: Some("2026-07-04".to_string()),
                end_date: Some("2026-07-05".to_string()),
                created_at: "2026-06-01T01:00:00Z".to_string(),
            },
            LinkedJourneyTicketRecord {
                ticket_id: "early".to_string(),
                start_date: Some("2026-07-01".to_string()),
                end_date: Some("2026-07-02".to_string()),
                created_at: "2026-06-01T00:00:00Z".to_string(),
            },
            LinkedJourneyTicketRecord {
                ticket_id: "unknown".to_string(),
                start_date: None,
                end_date: None,
                created_at: "2026-06-02T00:00:00Z".to_string(),
            },
        ];

        sort_linked_journey_ticket_records(&mut records);

        assert_eq!(records[0].ticket_id, "early");
        assert_eq!(records[1].ticket_id, "late");
        assert_eq!(records[2].ticket_id, "unknown");
        assert_eq!(
            derive_journey_date_range_from_linked_tickets(&records),
            (
                Some("2026-07-01".to_string()),
                Some("2026-07-05".to_string())
            )
        );
        assert_eq!(
            compare_optional_date(Some("2026-07-01"), None),
            std::cmp::Ordering::Less
        );
    }
}

fn lookup_coordinates(conn: &Connection, location: &TicketLocationPayload) -> Option<(f64, f64)> {
    let code = location.code.clone().unwrap_or_default();
    let name = location.name.clone();
    let search_like = format!("%{}%", name);

    let mut stmt = conn
        .prepare(
            "SELECT latitude, longitude
             FROM location_directory
             WHERE (
                    (?1 <> '' AND upper(COALESCE(code, '')) = upper(?1))
                 OR upper(COALESCE(name_en, '')) = upper(?2)
                 OR upper(COALESCE(name_zh, '')) = upper(?2)
                 OR upper(aliases_json) LIKE upper(?3)
             )
             AND latitude IS NOT NULL
             AND longitude IS NOT NULL
             ORDER BY CASE WHEN (?1 <> '' AND upper(COALESCE(code, '')) = upper(?1)) THEN 0 ELSE 1 END
             LIMIT 1",
        )
        .ok()?;

    stmt.query_row(params![&code, &name, &search_like], |row| Ok((row.get(0)?, row.get(1)?)))
        .ok()
}

fn parse_airline_row(row: &Row<'_>) -> rusqlite::Result<AirlinePayload> {
    let aliases_json: String = row.get(5)?;
    let aliases = serde_json::from_str::<Vec<String>>(&aliases_json).unwrap_or_default();

    Ok(AirlinePayload {
        id: row.get(0)?,
        iata_code: row.get(1)?,
        icao_code: row.get(2)?,
        name_en: row.get(3)?,
        name_zh: row.get(4)?,
        aliases,
        country_code: row.get(6)?,
        logo_key: row.get(7)?,
    })
}

fn parse_location_directory_row(row: &Row<'_>) -> rusqlite::Result<LocationDirectoryPayload> {
    let aliases_json: String = row.get(5)?;
    let aliases = serde_json::from_str::<Vec<String>>(&aliases_json).unwrap_or_default();

    Ok(LocationDirectoryPayload {
        id: row.get(0)?,
        location_type: row.get(1)?,
        code: row.get(2)?,
        name_zh: row.get(3)?,
        name_en: row.get(4)?,
        aliases,
        latitude: row.get(6)?,
        longitude: row.get(7)?,
        timezone: row.get(8)?,
        country_code: row.get(9)?,
    })
}

fn build_viewport(origin: &MapPointPayload, destination: &MapPointPayload) -> MapViewportPayload {
    MapViewportPayload {
        min_latitude: origin.latitude.min(destination.latitude),
        max_latitude: origin.latitude.max(destination.latitude),
        min_longitude: origin.longitude.min(destination.longitude),
        max_longitude: origin.longitude.max(destination.longitude),
    }
}

fn estimate_distance_km(origin: &MapPointPayload, destination: &MapPointPayload) -> u32 {
    let earth_radius_km = 6371.0_f64;
    let origin_lat = origin.latitude.to_radians();
    let destination_lat = destination.latitude.to_radians();
    let delta_lat = (destination.latitude - origin.latitude).to_radians();
    let delta_lon = (destination.longitude - origin.longitude).to_radians();

    let haversine = (delta_lat / 2.0).sin().powi(2)
        + origin_lat.cos() * destination_lat.cos() * (delta_lon / 2.0).sin().powi(2);
    let arc = 2.0 * haversine.sqrt().asin();

    (earth_radius_km * arc).round() as u32
}
