use crate::models::{
    AirlinePayload, LocationDirectoryPayload, MapPointPayload, MapRoutePayload, MapViewportPayload,
    MapSegmentPayload, StubPreviewPayload, TicketAttachmentPayload, TicketAttachmentUploadPayload,
    TicketDetailPayload, TicketDraftPayload, TicketLocationPayload, TicketRecordPayload,
    TicketSegmentPayload,
};
use chrono::{LocalResult, NaiveDateTime, TimeZone, Utc};
use chrono_tz::Tz;
use rusqlite::{params, Connection, Row};
use std::{
    ffi::OsStr,
    fs,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const SCHEMA_SQL: &str = include_str!("../../database/schema.sql");
const AIRLINES_SEED_JSON: &str = include_str!("../../src/data/airlines.seed.json");
const LOCATIONS_SEED_JSON: &str = include_str!("../../src/data/locations.seed.json");

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
    let journey_id = Uuid::new_v4().to_string();

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
            "INSERT INTO journeys (
                id, title, journey_type, primary_ticket_type, status,
                start_time_utc, end_time_utc, created_at_utc, updated_at_utc
             ) VALUES (?1, ?2, ?3, ?4, 'planned', ?5, ?6, ?7, ?8)",
            params![
                &journey_id,
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

        insert_segments(&conn, &journey_id, &draft.ticket_type, &effective_segments)?;

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
                &journey_id,
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
    let journey_id = existing_row
        .journey_id
        .clone()
        .ok_or_else(|| "Ticket journey relation is missing.".to_string())?;
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
            "UPDATE journeys
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
                &journey_id
            ],
        )
        .map_err(|err| err.to_string())?;

        conn.execute("DELETE FROM segments WHERE journey_id = ?1", [&journey_id])
            .map_err(|err| err.to_string())?;
        insert_segments(&conn, &journey_id, &draft.ticket_type, &effective_segments)?;

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
    let journey_id = existing_row
        .journey_id
        .clone()
        .ok_or_else(|| "Ticket journey relation is missing.".to_string())?;
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
            "UPDATE journeys
             SET status = ?1,
                 updated_at_utc = ?2
             WHERE id = ?3",
            params![journey_status_for_ticket_status(status), &updated_at, &journey_id],
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
    let journey_id = existing_row
        .journey_id
        .clone()
        .ok_or_else(|| "Ticket journey relation is missing.".to_string())?;
    let attachments = list_ticket_attachments(&conn, ticket_id)?;

    conn.execute_batch("BEGIN IMMEDIATE TRANSACTION;")
        .map_err(|err| err.to_string())?;

    let result = (|| {
        conn.execute("DELETE FROM ticket_attachments WHERE ticket_id = ?1", [ticket_id])
            .map_err(|err| err.to_string())?;
        conn.execute("DELETE FROM ticket_records WHERE id = ?1", [ticket_id])
            .map_err(|err| err.to_string())?;
        conn.execute("DELETE FROM segments WHERE journey_id = ?1", [&journey_id])
            .map_err(|err| err.to_string())?;
        conn.execute("DELETE FROM journeys WHERE id = ?1", [&journey_id])
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
        departure_time_local: ticket.departure_time_local.clone(),
        arrival_label: ticket.arrival.name.clone(),
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
        departure_time_local: draft.departure_time_local.clone(),
        arrival_time_local: draft.arrival_time_local.clone(),
        class_info: draft.class_info.clone(),
        seat_info: draft.seat_info.clone(),
        notes: draft.notes.clone(),
    };

    let mut segments = vec![primary_segment];
    if let Some(extra_segments) = &draft.segments {
        segments.extend(extra_segments.iter().cloned());
    }
    segments
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
            "INSERT INTO segments (
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

fn build_segment_metadata(segment: &TicketSegmentPayload) -> String {
    serde_json::json!({
        "notes": segment.notes,
        "departureCode": segment.departure.code,
        "arrivalCode": segment.arrival.code
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
    conn.execute_batch(SCHEMA_SQL).map_err(|err| err.to_string())?;
    seed_airlines(&conn)?;
    seed_location_directory(&conn)?;
    Ok(conn)
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

fn attachment_ticket_dir(app: &AppHandle, ticket_id: &str) -> Result<PathBuf, String> {
    Ok(attachment_root_dir(app)?.join(ticket_id))
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
