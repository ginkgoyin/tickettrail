use crate::{
    db,
    models::{
        AirlinePayload, BackupReadinessPayload, BackupRecordPayload, LocationDirectoryPayload,
        FlightDataSourceConfigPayload, FlightLookupCandidatePayload, FlightLookupLocationPayload,
        FlightLookupRequestPayload, StubPreviewPayload, TicketAttachmentPayload,
        TicketAttachmentUploadPayload, TicketDetailPayload, TicketDraftPayload, TicketRecordPayload,
    },
};
use chrono::Utc;
use std::fs;
use std::path::PathBuf;
use tauri::command;
use tauri::{AppHandle, Manager};

const MOCK_FLIGHT_LOOKUP_PROVIDER: &str = "aerodatabox";
const MOCK_FLIGHT_LOOKUP_PROVIDER_LABEL: &str = "AeroDataBox mock via Tauri";
const MOCK_FLIGHT_LOOKUP_SOURCE_NOTE: &str =
    "Phase A mock command only. This result is generated locally through the Tauri boundary and should be reviewed before saving.";
const FLIGHT_DATA_SOURCE_CONFIG_FILE: &str = "flight-data-source.json";

#[command]
pub fn get_bootstrap_summary(app: AppHandle) -> Result<String, String> {
    let ticket_count = db::list_tickets(&app)?.len();
    Ok(format!(
        "TicketTrail MVP ready: SQLite wired, {} persisted ticket(s) available.",
        ticket_count
    ))
}

#[command]
pub fn list_tickets(app: AppHandle) -> Result<Vec<TicketRecordPayload>, String> {
    db::list_tickets(&app)
}

#[command]
pub fn create_ticket(app: AppHandle, draft: TicketDraftPayload) -> Result<TicketRecordPayload, String> {
    db::create_ticket(&app, draft)
}

#[command]
pub fn update_ticket(
    app: AppHandle,
    ticket_id: String,
    draft: TicketDraftPayload,
) -> Result<TicketRecordPayload, String> {
    db::update_ticket(&app, &ticket_id, draft)
}

#[command]
pub fn update_ticket_status(
    app: AppHandle,
    ticket_id: String,
    status: String,
) -> Result<TicketRecordPayload, String> {
    db::update_ticket_status(&app, &ticket_id, &status)
}

#[command]
pub fn delete_ticket(app: AppHandle, ticket_id: String) -> Result<(), String> {
    db::delete_ticket(&app, &ticket_id)
}

#[command]
pub fn add_ticket_attachment(
    app: AppHandle,
    ticket_id: String,
    upload: TicketAttachmentUploadPayload,
) -> Result<TicketAttachmentPayload, String> {
    db::add_ticket_attachment(&app, &ticket_id, upload)
}

#[command]
pub fn delete_ticket_attachment(app: AppHandle, attachment_id: String) -> Result<(), String> {
    db::delete_ticket_attachment(&app, &attachment_id)
}

#[command]
pub fn get_ticket_detail(app: AppHandle, ticket_id: String) -> Result<TicketDetailPayload, String> {
    db::get_ticket_detail(&app, &ticket_id)
}

#[command]
pub fn search_airlines(app: AppHandle, query: String) -> Result<Vec<AirlinePayload>, String> {
    db::search_airlines(&app, &query)
}

#[command]
pub fn search_locations(app: AppHandle, query: String) -> Result<Vec<LocationDirectoryPayload>, String> {
    db::search_locations(&app, &query)
}

#[command]
pub fn list_backups(app: AppHandle) -> Result<Vec<BackupRecordPayload>, String> {
    db::list_backups(&app)
}

#[command]
pub fn create_backup(app: AppHandle) -> Result<BackupRecordPayload, String> {
    db::create_backup(&app)
}

#[command]
pub fn get_backup_readiness(app: AppHandle) -> Result<BackupReadinessPayload, String> {
    db::get_backup_readiness(&app)
}

#[command]
pub fn restore_backup(app: AppHandle, backup_id: String) -> Result<(), String> {
    db::restore_backup(&app, &backup_id)
}

#[command]
pub fn export_backup(app: AppHandle, backup_id: String) -> Result<String, String> {
    db::export_backup(&app, &backup_id)
}

#[command]
pub fn export_archive_bundle(app: AppHandle) -> Result<String, String> {
    db::export_archive_bundle(&app)
}

#[command]
pub fn import_archive_bundle(app: AppHandle, bundle_path: String) -> Result<(), String> {
    db::import_archive_bundle(&app, &bundle_path)
}

#[command]
pub fn get_flight_data_source_config(app: AppHandle) -> Result<FlightDataSourceConfigPayload, String> {
    let config_path = flight_data_source_config_path(&app)?;
    if !config_path.exists() {
        return Ok(default_flight_data_source_config());
    }

    let config_text = fs::read_to_string(&config_path)
        .map_err(|_| "Failed to read local flight data source config.".to_string())?;
    let mut config: FlightDataSourceConfigPayload = serde_json::from_str(&config_text)
        .map_err(|_| "Failed to parse local flight data source config.".to_string())?;
    normalize_flight_data_source_config(&mut config);
    Ok(config)
}

#[command]
pub fn save_flight_data_source_config(
    app: AppHandle,
    config: FlightDataSourceConfigPayload,
) -> Result<FlightDataSourceConfigPayload, String> {
    let mut normalized = config;
    normalize_flight_data_source_config(&mut normalized);
    validate_flight_data_source_provider(&normalized.provider)?;
    normalized.updated_at = Some(Utc::now().to_rfc3339());

    let config_path = flight_data_source_config_path(&app)?;
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|_| "Failed to prepare local config directory.".to_string())?;
    }

    let serialized = serde_json::to_string_pretty(&normalized)
        .map_err(|_| "Failed to serialize local flight data source config.".to_string())?;
    fs::write(&config_path, serialized)
        .map_err(|_| "Failed to save local flight data source config.".to_string())?;

    Ok(normalized)
}

#[command]
pub fn create_stub_preview(code: String, route_label: String) -> StubPreviewPayload {
    StubPreviewPayload {
        title: "Ticket Stub Preview".into(),
        subtitle: format!("Reference {}", code),
        transport_badge: "PREVIEW".into(),
        primary_code: code,
        departure_label: "Departure".into(),
        departure_terminal: None,
        departure_time_local: "--".into(),
        arrival_label: "Arrival".into(),
        arrival_terminal: None,
        arrival_time_local: "--".into(),
        carrier_name: "Carrier".into(),
        seat_label: "TBD / TBD".into(),
        notes: "Preview payload".into(),
        route_label,
        accent: "#70d4ff".into(),
    }
}

#[command]
pub fn lookup_flight_candidates(
    request: FlightLookupRequestPayload,
) -> Result<Vec<FlightLookupCandidatePayload>, String> {
    let normalized_flight_number = normalize_flight_number(&request.flight_number);
    let lookup_date = request.date.trim();
    let provider = request.provider.trim().to_lowercase();

    if provider != MOCK_FLIGHT_LOOKUP_PROVIDER {
        return Err("unsupported_provider".into());
    }

    if normalized_flight_number.is_empty() || !is_iso_date(lookup_date) {
        return Ok(vec![]);
    }

    Ok(mock_templates_for_flight(&normalized_flight_number)
        .into_iter()
        .enumerate()
        .map(|(index, template)| FlightLookupCandidatePayload {
            id: format!("{}-{}-{}", normalized_flight_number, lookup_date, index),
            provider: MOCK_FLIGHT_LOOKUP_PROVIDER.into(),
            provider_label: MOCK_FLIGHT_LOOKUP_PROVIDER_LABEL.into(),
            source_note: MOCK_FLIGHT_LOOKUP_SOURCE_NOTE.into(),
            carrier_name: template.carrier_name,
            code: template.code,
            departure: template.departure,
            arrival: template.arrival,
            departure_terminal: template.departure_terminal,
            arrival_terminal: template.arrival_terminal,
            departure_time_local: format!("{}T{}", lookup_date, template.departure_time),
            arrival_time_local: format!("{}T{}", lookup_date, template.arrival_time),
            aircraft: template.aircraft,
            flight_status: template.flight_status,
            confidence: template.confidence,
        })
        .collect())
}

fn default_flight_data_source_config() -> FlightDataSourceConfigPayload {
    FlightDataSourceConfigPayload {
        provider: "mock".into(),
        api_key: None,
        updated_at: None,
    }
}

fn flight_data_source_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let path_service = app.path();
    let base_dir = path_service
        .app_config_dir()
        .or_else(|_| path_service.app_data_dir())
        .map_err(|err| err.to_string())?;
    Ok(base_dir.join(FLIGHT_DATA_SOURCE_CONFIG_FILE))
}

fn validate_flight_data_source_provider(provider: &str) -> Result<(), String> {
    match provider {
        "mock" | "aerodatabox" => Ok(()),
        _ => Err("Unsupported flight data source provider.".into()),
    }
}

fn normalize_flight_data_source_config(config: &mut FlightDataSourceConfigPayload) {
    config.provider = config.provider.trim().to_lowercase();
    config.api_key = config
        .api_key
        .as_ref()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
}

#[derive(Clone)]
struct MockFlightTemplate {
    carrier_name: String,
    code: String,
    departure: FlightLookupLocationPayload,
    arrival: FlightLookupLocationPayload,
    departure_terminal: Option<String>,
    arrival_terminal: Option<String>,
    departure_time: String,
    arrival_time: String,
    aircraft: Option<String>,
    flight_status: Option<String>,
    confidence: Option<String>,
}

fn mock_templates_for_flight(flight_number: &str) -> Vec<MockFlightTemplate> {
    match flight_number {
        "MF802" => vec![MockFlightTemplate {
            carrier_name: "XiamenAir".into(),
            code: "MF802".into(),
            departure: FlightLookupLocationPayload {
                name: "Sydney Kingsford Smith Airport".into(),
                code: "SYD".into(),
                timezone: "Australia/Sydney".into(),
            },
            arrival: FlightLookupLocationPayload {
                name: "Xiamen Gaoqi International Airport".into(),
                code: "XMN".into(),
                timezone: "Asia/Shanghai".into(),
            },
            departure_terminal: Some("T1".into()),
            arrival_terminal: Some("T3".into()),
            departure_time: "11:25".into(),
            arrival_time: "19:40".into(),
            aircraft: Some("Boeing 787-9".into()),
            flight_status: Some("scheduled".into()),
            confidence: Some("high".into()),
        }],
        "MU562" => vec![MockFlightTemplate {
            carrier_name: "China Eastern".into(),
            code: "MU562".into(),
            departure: FlightLookupLocationPayload {
                name: "Sydney Kingsford Smith Airport".into(),
                code: "SYD".into(),
                timezone: "Australia/Sydney".into(),
            },
            arrival: FlightLookupLocationPayload {
                name: "Shanghai Pudong International Airport".into(),
                code: "PVG".into(),
                timezone: "Asia/Shanghai".into(),
            },
            departure_terminal: Some("T1".into()),
            arrival_terminal: Some("T1".into()),
            departure_time: "12:10".into(),
            arrival_time: "20:35".into(),
            aircraft: Some("Airbus A330-200".into()),
            flight_status: Some("scheduled".into()),
            confidence: Some("high".into()),
        }],
        "CZ326" => vec![MockFlightTemplate {
            carrier_name: "China Southern".into(),
            code: "CZ326".into(),
            departure: FlightLookupLocationPayload {
                name: "Sydney Kingsford Smith Airport".into(),
                code: "SYD".into(),
                timezone: "Australia/Sydney".into(),
            },
            arrival: FlightLookupLocationPayload {
                name: "Guangzhou Baiyun International Airport".into(),
                code: "CAN".into(),
                timezone: "Asia/Shanghai".into(),
            },
            departure_terminal: Some("T1".into()),
            arrival_terminal: Some("T2".into()),
            departure_time: "10:45".into(),
            arrival_time: "18:20".into(),
            aircraft: Some("Boeing 787-8".into()),
            flight_status: Some("scheduled".into()),
            confidence: Some("high".into()),
        }],
        "QF127" => vec![MockFlightTemplate {
            carrier_name: "Qantas".into(),
            code: "QF127".into(),
            departure: FlightLookupLocationPayload {
                name: "Sydney Kingsford Smith Airport".into(),
                code: "SYD".into(),
                timezone: "Australia/Sydney".into(),
            },
            arrival: FlightLookupLocationPayload {
                name: "Hong Kong International Airport".into(),
                code: "HKG".into(),
                timezone: "Asia/Hong_Kong".into(),
            },
            departure_terminal: Some("T1".into()),
            arrival_terminal: Some("T1".into()),
            departure_time: "09:30".into(),
            arrival_time: "16:10".into(),
            aircraft: Some("Airbus A330-300".into()),
            flight_status: Some("scheduled".into()),
            confidence: Some("high".into()),
        }],
        _ => vec![],
    }
}

fn normalize_flight_number(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect::<String>()
        .trim()
        .to_uppercase()
}

fn is_iso_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| matches!(index, 4 | 7) || byte.is_ascii_digit())
}

#[cfg(test)]
mod tests {
    use super::{
        default_flight_data_source_config, is_iso_date, lookup_flight_candidates,
        normalize_flight_data_source_config, normalize_flight_number,
        validate_flight_data_source_provider,
    };
    use crate::models::{FlightDataSourceConfigPayload, FlightLookupRequestPayload};

    #[test]
    fn normalize_flight_number_strips_spacing_and_symbols() {
        assert_eq!(normalize_flight_number(" mf-802 "), "MF802");
    }

    #[test]
    fn iso_date_validation_accepts_expected_shape() {
        assert!(is_iso_date("2026-06-05"));
        assert!(!is_iso_date("2026/06/05"));
        assert!(!is_iso_date("20260605"));
    }

    #[test]
    fn mock_lookup_returns_candidates_for_supported_flights() {
        let results = lookup_flight_candidates(FlightLookupRequestPayload {
            flight_number: "MF802".into(),
            date: "2026-06-05".into(),
            provider: "aerodatabox".into(),
            locale: None,
            departure_airport_hint: None,
            arrival_airport_hint: None,
            country_hint: None,
        })
        .expect("mock lookup should succeed");

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].code, "MF802");
        assert_eq!(results[0].departure.code, "SYD");
        assert_eq!(results[0].arrival.code, "XMN");
    }

    #[test]
    fn mock_lookup_returns_empty_for_unknown_flights() {
        let results = lookup_flight_candidates(FlightLookupRequestPayload {
            flight_number: "ZZ999".into(),
            date: "2026-06-05".into(),
            provider: "aerodatabox".into(),
            locale: None,
            departure_airport_hint: None,
            arrival_airport_hint: None,
            country_hint: None,
        })
        .expect("mock lookup should succeed");

        assert!(results.is_empty());
    }

    #[test]
    fn default_flight_data_source_config_uses_mock_provider() {
        let config = default_flight_data_source_config();
        assert_eq!(config.provider, "mock");
        assert!(config.api_key.is_none());
    }

    #[test]
    fn normalize_flight_data_source_config_trims_api_key() {
        let mut config = FlightDataSourceConfigPayload {
            provider: " AeroDataBox ".into(),
            api_key: Some("  secret-key  ".into()),
            updated_at: None,
        };

        normalize_flight_data_source_config(&mut config);

        assert_eq!(config.provider, "aerodatabox");
        assert_eq!(config.api_key.as_deref(), Some("secret-key"));
    }

    #[test]
    fn validate_flight_data_source_provider_rejects_unknown_values() {
        assert!(validate_flight_data_source_provider("mock").is_ok());
        assert!(validate_flight_data_source_provider("aerodatabox").is_ok());
        assert!(validate_flight_data_source_provider("other").is_err());
    }
}
