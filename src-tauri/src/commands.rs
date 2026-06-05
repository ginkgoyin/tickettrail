use crate::{
    db,
    flight_lookup::{self, PROVIDER_AERODATABOX, PROVIDER_MOCK},
    models::{
        AirlinePayload, BackupReadinessPayload, BackupRecordPayload, LocationDirectoryPayload,
        FlightDataSourceConfigPayload, FlightLookupCandidatePayload, FlightLookupRequestPayload,
        StubPreviewPayload, TicketAttachmentPayload,
        TicketAttachmentUploadPayload, TicketDetailPayload, TicketDraftPayload, TicketRecordPayload,
    },
};
use chrono::Utc;
use std::fs;
use std::path::PathBuf;
use tauri::command;
use tauri::{AppHandle, Manager};

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
    load_flight_data_source_config(&app)
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
    app: AppHandle,
    request: FlightLookupRequestPayload,
) -> Result<Vec<FlightLookupCandidatePayload>, crate::models::FlightLookupErrorPayload> {
    let config = load_flight_data_source_config(&app).ok();
    flight_lookup::lookup_candidates(&request, config.as_ref())
}

fn default_flight_data_source_config() -> FlightDataSourceConfigPayload {
    FlightDataSourceConfigPayload {
        provider: PROVIDER_MOCK.into(),
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
        PROVIDER_MOCK | PROVIDER_AERODATABOX => Ok(()),
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

fn load_flight_data_source_config(app: &AppHandle) -> Result<FlightDataSourceConfigPayload, String> {
    let config_path = flight_data_source_config_path(app)?;
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

#[cfg(test)]
mod tests {
    use super::{
        default_flight_data_source_config, normalize_flight_data_source_config,
        validate_flight_data_source_provider, PROVIDER_AERODATABOX, PROVIDER_MOCK,
    };
    use crate::models::FlightDataSourceConfigPayload;

    #[test]
    fn default_flight_data_source_config_uses_mock_provider() {
        let config = default_flight_data_source_config();
        assert_eq!(config.provider, PROVIDER_MOCK);
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
        assert!(validate_flight_data_source_provider(PROVIDER_MOCK).is_ok());
        assert!(validate_flight_data_source_provider(PROVIDER_AERODATABOX).is_ok());
        assert!(validate_flight_data_source_provider("other").is_err());
    }
}
