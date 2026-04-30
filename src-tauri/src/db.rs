use crate::models::{
    MapPointPayload, MapRoutePayload, MapViewportPayload, StubPreviewPayload, TicketDetailPayload,
    TicketDraftPayload, TicketLocationPayload, TicketRecordPayload,
};
use chrono::{LocalResult, NaiveDateTime, TimeZone, Utc};
use chrono_tz::Tz;
use rusqlite::{params, Connection};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const SCHEMA_SQL: &str = include_str!("../../database/schema.sql");

pub fn list_tickets(app: &AppHandle) -> Result<Vec<TicketRecordPayload>, String> {
    let conn = open_connection(app)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, ticket_type, carrier_name, code, raw_payload_json, normalized_status, created_at_utc, updated_at_utc
             FROM ticket_records
             ORDER BY created_at_utc DESC",
        )
        .map_err(|err| err.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let ticket_type: String = row.get(1)?;
            let carrier_name: String = row.get(2)?;
            let code: String = row.get(3)?;
            let raw_payload_json: String = row.get(4)?;
            let normalized_status: String = row.get(5)?;
            let created_at: String = row.get(6)?;
            let updated_at: String = row.get(7)?;

            let draft: TicketDraftPayload = serde_json::from_str(&raw_payload_json).map_err(|err| {
                rusqlite::Error::FromSqlConversionFailure(
                    raw_payload_json.len(),
                    rusqlite::types::Type::Text,
                    Box::new(err),
                )
            })?;

            Ok(build_ticket_record(
                id,
                ticket_type,
                carrier_name,
                code,
                draft,
                normalized_status,
                created_at,
                updated_at,
            ))
        })
        .map_err(|err| err.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())
}

pub fn create_ticket(
    app: &AppHandle,
    draft: TicketDraftPayload,
) -> Result<TicketRecordPayload, String> {
    validate_draft(&draft)?;

    let departure_time_utc = normalize_to_utc(&draft.departure_time_local, &draft.departure.timezone)?;
    let arrival_time_utc = normalize_to_utc(&draft.arrival_time_local, &draft.arrival.timezone)?;
    let created_at = Utc::now().to_rfc3339();

    let ticket_id = Uuid::new_v4().to_string();
    let journey_id = Uuid::new_v4().to_string();
    let segment_id = Uuid::new_v4().to_string();

    let conn = open_connection(app)?;
    let raw_payload_json = serde_json::to_string(&draft).map_err(|err| err.to_string())?;
    let route_label = format!("{} -> {}", draft.departure.name, draft.arrival.name);

    conn.execute_batch("BEGIN IMMEDIATE TRANSACTION;")
        .map_err(|err| err.to_string())?;

    let result = (|| {
        conn.execute(
            "INSERT INTO journeys (
                id, title, journey_type, primary_ticket_type, status,
                start_time_utc, end_time_utc, created_at_utc, updated_at_utc
             ) VALUES (?1, ?2, 'single_leg', ?3, 'planned', ?4, ?5, ?6, ?7)",
            params![
                &journey_id,
                &route_label,
                &draft.ticket_type,
                &departure_time_utc,
                &arrival_time_utc,
                &created_at,
                &created_at
            ],
        )
        .map_err(|err| err.to_string())?;

        conn.execute(
            "INSERT INTO segments (
                id, journey_id, segment_index, transport_type, carrier_name, code,
                departure_location_id, arrival_location_id, departure_name_raw, arrival_name_raw,
                departure_time_local, arrival_time_local, departure_timezone, arrival_timezone,
                departure_time_utc, arrival_time_utc, class_info, seat_info, metadata_json
             ) VALUES (
                ?1, ?2, 0, ?3, ?4, ?5,
                NULL, NULL, ?6, ?7,
                ?8, ?9, ?10, ?11,
                ?12, ?13, ?14, ?15, ?16
             )",
            params![
                &segment_id,
                &journey_id,
                &draft.ticket_type,
                &draft.carrier_name,
                &draft.code,
                &draft.departure.name,
                &draft.arrival.name,
                &draft.departure_time_local,
                &draft.arrival_time_local,
                &draft.departure.timezone,
                &draft.arrival.timezone,
                &departure_time_utc,
                &arrival_time_utc,
                &draft.class_info,
                &draft.seat_info,
                serde_json::json!({
                    "notes": draft.notes,
                    "departureCode": draft.departure.code,
                    "arrivalCode": draft.arrival.code
                })
                .to_string()
            ],
        )
        .map_err(|err| err.to_string())?;

        conn.execute(
            "INSERT INTO ticket_records (
                id, ticket_type, source_type, carrier_name, code, raw_payload_json,
                normalized_status, journey_id, created_at_utc, updated_at_utc, version
             ) VALUES (?1, ?2, 'manual', ?3, ?4, ?5, 'normalized', ?6, ?7, ?8, 1)",
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

pub fn get_ticket_detail(app: &AppHandle, ticket_id: &str) -> Result<TicketDetailPayload, String> {
    let conn = open_connection(app)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, ticket_type, carrier_name, code, raw_payload_json, normalized_status, created_at_utc, updated_at_utc
             FROM ticket_records
             WHERE id = ?1",
        )
        .map_err(|err| err.to_string())?;

    let ticket = stmt
        .query_row([ticket_id], |row| {
            let id: String = row.get(0)?;
            let ticket_type: String = row.get(1)?;
            let carrier_name: String = row.get(2)?;
            let code: String = row.get(3)?;
            let raw_payload_json: String = row.get(4)?;
            let normalized_status: String = row.get(5)?;
            let created_at: String = row.get(6)?;
            let updated_at: String = row.get(7)?;
            let draft: TicketDraftPayload = serde_json::from_str(&raw_payload_json).map_err(|err| {
                rusqlite::Error::FromSqlConversionFailure(
                    raw_payload_json.len(),
                    rusqlite::types::Type::Text,
                    Box::new(err),
                )
            })?;

            Ok(build_ticket_record(
                id,
                ticket_type,
                carrier_name,
                code,
                draft,
                normalized_status,
                created_at,
                updated_at,
            ))
        })
        .map_err(|err| err.to_string())?;

    Ok(build_ticket_detail(ticket))
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
    let route_label = format!("{} -> {}", draft.departure.name, draft.arrival.name);

    TicketRecordPayload {
        id,
        ticket_type,
        carrier_name,
        code,
        departure: TicketLocationPayload {
            name: draft.departure.name,
            code: normalize_optional_string(draft.departure.code),
            timezone: draft.departure.timezone,
        },
        arrival: TicketLocationPayload {
            name: draft.arrival.name,
            code: normalize_optional_string(draft.arrival.code),
            timezone: draft.arrival.timezone,
        },
        departure_time_local: draft.departure_time_local,
        arrival_time_local: draft.arrival_time_local,
        class_info: draft.class_info,
        seat_info: draft.seat_info,
        notes: draft.notes,
        route_label,
        status: map_status(&normalized_status),
        created_at,
        updated_at,
    }
}

fn build_ticket_detail(ticket: TicketRecordPayload) -> TicketDetailPayload {
    let origin = resolve_map_point(&ticket.departure);
    let destination = resolve_map_point(&ticket.arrival);
    let viewport = build_viewport(&origin, &destination);
    let distance_hint_km = estimate_distance_km(&origin, &destination);

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

    TicketDetailPayload { ticket, map, stub }
}

fn map_status(value: &str) -> String {
    if value == "normalized" {
        "saved".to_string()
    } else {
        value.to_string()
    }
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

fn validate_draft(draft: &TicketDraftPayload) -> Result<(), String> {
    if draft.carrier_name.trim().is_empty() {
        return Err("Carrier name is required.".to_string());
    }
    if draft.code.trim().is_empty() {
        return Err("Flight or train number is required.".to_string());
    }
    if draft.departure.name.trim().is_empty() || draft.arrival.name.trim().is_empty() {
        return Err("Departure and arrival names are required.".to_string());
    }
    if draft.departure.timezone.trim().is_empty() || draft.arrival.timezone.trim().is_empty() {
        return Err("Departure and arrival timezones are required.".to_string());
    }

    normalize_to_utc(&draft.departure_time_local, &draft.departure.timezone)?;
    normalize_to_utc(&draft.arrival_time_local, &draft.arrival.timezone)?;

    Ok(())
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
    Ok(conn)
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| err.to_string())?;
    Ok(data_dir.join("tickettrail.sqlite3"))
}

fn resolve_map_point(location: &TicketLocationPayload) -> MapPointPayload {
    let (latitude, longitude) = resolve_coordinates(location);

    MapPointPayload {
        label: location.name.clone(),
        code: location.code.clone(),
        timezone: location.timezone.clone(),
        latitude,
        longitude,
    }
}

fn resolve_coordinates(location: &TicketLocationPayload) -> (f64, f64) {
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
