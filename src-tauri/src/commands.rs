use crate::{
    db,
    flight_lookup::{
        self, AERODATABOX_GATEWAY_API_MARKET, AERODATABOX_GATEWAY_RAPID_API,
        PROVIDER_AERODATABOX, PROVIDER_MOCK,
    },
    models::{
        AirlinePayload, BackupReadinessPayload, BackupRecordPayload, LocationDirectoryPayload,
        FlightDataSourceConfigPayload, FlightDataSourceConfigSavePayload,
        FlightLookupCandidatePayload, FlightLookupRequestPayload, StubPreviewPayload,
        TicketAttachmentPayload,
        TicketAttachmentUploadPayload, TicketDetailPayload, TicketDraftPayload, TicketRecordPayload,
    },
};
use chrono::Utc;
use std::fs;
use std::path::PathBuf;
use tauri::command;
use tauri::{AppHandle, Manager};

const FLIGHT_DATA_SOURCE_CONFIG_FILE: &str = "flight-data-source.json";
const FLIGHT_DATA_SOURCE_SECRET_FILE: &str = "flight-data-source.secret.json";

#[derive(Clone, Debug, serde::Deserialize, serde::Serialize)]
struct StoredFlightDataSourceConfig {
    provider: String,
    gateway: Option<String>,
    updated_at: Option<String>,
    #[serde(alias = "apiKey", default)]
    legacy_api_key: Option<String>,
}

#[derive(Clone, Debug, serde::Deserialize, serde::Serialize)]
struct StoredFlightDataSourceSecret {
    api_key: String,
    updated_at: Option<String>,
}

#[derive(Clone, Debug)]
struct EffectiveFlightDataSourceConfig {
    provider: String,
    gateway: String,
    api_key: Option<String>,
    updated_at: Option<String>,
}

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
    Ok(public_flight_data_source_config(&load_effective_flight_data_source_config(&app)?))
}

#[command]
pub fn save_flight_data_source_config(
    app: AppHandle,
    config: FlightDataSourceConfigSavePayload,
) -> Result<FlightDataSourceConfigPayload, String> {
    let existing = load_effective_flight_data_source_config(&app)?;
    let mut normalized = normalize_flight_data_source_save_payload(config);
    validate_flight_data_source_provider(&normalized.provider)?;
    validate_flight_data_source_gateway(&normalized.gateway)?;
    normalized.updated_at = Some(Utc::now().to_rfc3339());

    let config_path = flight_data_source_config_path(&app)?;
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|_| "Failed to prepare local config directory.".to_string())?;
    }

    let serialized = serde_json::to_string_pretty(&StoredFlightDataSourceConfig {
        provider: normalized.provider.clone(),
        gateway: Some(normalized.gateway.clone()),
        updated_at: normalized.updated_at.clone(),
        legacy_api_key: None,
    })
    .map_err(|_| "Failed to serialize local flight data source config.".to_string())?;
    fs::write(&config_path, serialized)
        .map_err(|_| "Failed to save local flight data source config.".to_string())?;

    write_flight_data_source_secret(
        &app,
        normalized
            .api_key
            .as_deref()
            .or(existing.api_key.as_deref()),
        normalized.updated_at.as_deref(),
        normalized.clear_api_key,
    )?;

    Ok(public_flight_data_source_config(&load_effective_flight_data_source_config(&app)?))
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
    let config = load_effective_flight_data_source_config(&app).ok();
    let provider_config = config.as_ref().map(|value| flight_lookup::FlightLookupProviderConfig {
        provider: value.provider.clone(),
        gateway: value.gateway.clone(),
        api_key: value.api_key.clone(),
    });
    flight_lookup::lookup_candidates(&request, provider_config.as_ref())
}

fn default_flight_data_source_config() -> EffectiveFlightDataSourceConfig {
    EffectiveFlightDataSourceConfig {
        provider: PROVIDER_MOCK.into(),
        gateway: AERODATABOX_GATEWAY_API_MARKET.into(),
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

fn flight_data_source_secret_path(app: &AppHandle) -> Result<PathBuf, String> {
    let path_service = app.path();
    let base_dir = path_service
        .app_config_dir()
        .or_else(|_| path_service.app_data_dir())
        .map_err(|err| err.to_string())?;
    Ok(base_dir.join(FLIGHT_DATA_SOURCE_SECRET_FILE))
}

fn validate_flight_data_source_provider(provider: &str) -> Result<(), String> {
    match provider {
        PROVIDER_MOCK | PROVIDER_AERODATABOX => Ok(()),
        _ => Err("Unsupported flight data source provider.".into()),
    }
}

fn normalize_flight_data_source_gateway(value: Option<&str>) -> String {
    match value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(AERODATABOX_GATEWAY_API_MARKET)
        .to_lowercase()
        .as_str()
    {
        "rapidapi" | "rapid_api" | "rapid-api" => AERODATABOX_GATEWAY_RAPID_API.into(),
        _ => AERODATABOX_GATEWAY_API_MARKET.into(),
    }
}

fn validate_flight_data_source_gateway(gateway: &str) -> Result<(), String> {
    match gateway {
        AERODATABOX_GATEWAY_API_MARKET | AERODATABOX_GATEWAY_RAPID_API => Ok(()),
        _ => Err("Unsupported AeroDataBox gateway.".into()),
    }
}

fn normalize_flight_data_source_save_payload(
    config: FlightDataSourceConfigSavePayload,
) -> FlightDataSourceSaveState {
    FlightDataSourceSaveState {
        provider: config.provider.trim().to_lowercase(),
        gateway: normalize_flight_data_source_gateway(config.gateway.as_deref()),
        api_key: config
            .api_key
            .as_ref()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty()),
        clear_api_key: config.clear_api_key.unwrap_or(false),
        updated_at: None,
    }
}

fn normalize_stored_flight_data_source_config(config: &mut StoredFlightDataSourceConfig) {
    config.provider = config.provider.trim().to_lowercase();
    config.gateway = Some(normalize_flight_data_source_gateway(config.gateway.as_deref()));
}

fn normalize_stored_flight_data_source_secret(secret: &mut StoredFlightDataSourceSecret) {
    secret.api_key = secret.api_key.trim().to_string();
}

fn load_effective_flight_data_source_config(
    app: &AppHandle,
) -> Result<EffectiveFlightDataSourceConfig, String> {
    let config_path = flight_data_source_config_path(app)?;
    let mut config = if !config_path.exists() {
        let default = default_flight_data_source_config();
        StoredFlightDataSourceConfig {
            provider: default.provider,
            gateway: Some(default.gateway),
            updated_at: default.updated_at,
            legacy_api_key: None,
        }
    } else {
        let config_text = fs::read_to_string(&config_path)
            .map_err(|_| "Failed to read local flight data source config.".to_string())?;
        let mut stored: StoredFlightDataSourceConfig = serde_json::from_str(&config_text)
            .map_err(|_| "Failed to parse local flight data source config.".to_string())?;
        normalize_stored_flight_data_source_config(&mut stored);
        stored
    };

    validate_flight_data_source_provider(&config.provider)?;
    let gateway = normalize_flight_data_source_gateway(config.gateway.as_deref());
    validate_flight_data_source_gateway(&gateway)?;

    let secret = load_flight_data_source_secret(app)?;
    let legacy_api_key = config
        .legacy_api_key
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    if config.updated_at.is_none() {
        config.updated_at = secret.as_ref().and_then(|value| value.updated_at.clone());
    }

    Ok(EffectiveFlightDataSourceConfig {
        provider: config.provider,
        gateway,
        api_key: secret.map(|value| value.api_key).or(legacy_api_key),
        updated_at: config.updated_at,
    })
}

fn public_flight_data_source_config(
    config: &EffectiveFlightDataSourceConfig,
) -> FlightDataSourceConfigPayload {
    FlightDataSourceConfigPayload {
        provider: config.provider.clone(),
        gateway: config.gateway.clone(),
        has_api_key: config.api_key.is_some(),
        api_key_preview: config.api_key.as_deref().map(mask_api_key_preview),
        updated_at: config.updated_at.clone(),
    }
}

fn load_flight_data_source_secret(
    app: &AppHandle,
) -> Result<Option<StoredFlightDataSourceSecret>, String> {
    let secret_path = flight_data_source_secret_path(app)?;
    if !secret_path.exists() {
        return Ok(None);
    }

    let secret_text = fs::read_to_string(&secret_path)
        .map_err(|_| "Failed to read local flight data source secret.".to_string())?;
    let mut secret: StoredFlightDataSourceSecret = serde_json::from_str(&secret_text)
        .map_err(|_| "Failed to parse local flight data source secret.".to_string())?;
    normalize_stored_flight_data_source_secret(&mut secret);

    if secret.api_key.is_empty() {
        return Ok(None);
    }

    Ok(Some(secret))
}

fn write_flight_data_source_secret(
    app: &AppHandle,
    api_key: Option<&str>,
    updated_at: Option<&str>,
    clear_api_key: bool,
) -> Result<(), String> {
    let secret_path = flight_data_source_secret_path(app)?;

    if clear_api_key {
        if secret_path.exists() {
            fs::remove_file(&secret_path)
                .map_err(|_| "Failed to clear local flight data source secret.".to_string())?;
        }
        return Ok(());
    }

    let Some(raw_key) = api_key.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(());
    };

    if let Some(parent) = secret_path.parent() {
        fs::create_dir_all(parent).map_err(|_| "Failed to prepare local secret directory.".to_string())?;
    }

    let serialized = serde_json::to_string_pretty(&StoredFlightDataSourceSecret {
        api_key: raw_key.to_string(),
        updated_at: updated_at.map(str::to_string),
    })
    .map_err(|_| "Failed to serialize local flight data source secret.".to_string())?;

    fs::write(&secret_path, serialized)
        .map_err(|_| "Failed to save local flight data source secret.".to_string())?;

    Ok(())
}

fn mask_api_key_preview(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return "API key saved".into();
    }

    let visible_suffix = trimmed
        .chars()
        .rev()
        .take(4)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<String>();

    if visible_suffix.is_empty() {
        "API key saved".into()
    } else {
        format!("********{}", visible_suffix)
    }
}

#[derive(Clone, Debug)]
struct FlightDataSourceSaveState {
    provider: String,
    gateway: String,
    api_key: Option<String>,
    clear_api_key: bool,
    updated_at: Option<String>,
}


#[cfg(test)]
mod tests {
    use super::{
        default_flight_data_source_config, mask_api_key_preview,
        normalize_flight_data_source_save_payload, public_flight_data_source_config,
        validate_flight_data_source_gateway, validate_flight_data_source_provider,
        AERODATABOX_GATEWAY_API_MARKET, AERODATABOX_GATEWAY_RAPID_API,
        EffectiveFlightDataSourceConfig, PROVIDER_AERODATABOX, PROVIDER_MOCK,
    };
    use crate::models::FlightDataSourceConfigSavePayload;

    #[test]
    fn default_flight_data_source_config_uses_mock_provider() {
        let config = default_flight_data_source_config();
        assert_eq!(config.provider, PROVIDER_MOCK);
        assert_eq!(config.gateway, AERODATABOX_GATEWAY_API_MARKET);
        assert!(config.api_key.is_none());
    }

    #[test]
    fn normalize_flight_data_source_save_payload_trims_api_key() {
        let config = FlightDataSourceConfigSavePayload {
            provider: " AeroDataBox ".into(),
            gateway: None,
            api_key: Some("  secret-key  ".into()),
            clear_api_key: None,
        };

        let normalized = normalize_flight_data_source_save_payload(config);

        assert_eq!(normalized.provider, "aerodatabox");
        assert_eq!(normalized.gateway, AERODATABOX_GATEWAY_API_MARKET);
        assert_eq!(normalized.api_key.as_deref(), Some("secret-key"));
    }

    #[test]
    fn public_flight_data_source_config_hides_raw_key() {
        let public_config = public_flight_data_source_config(&EffectiveFlightDataSourceConfig {
            provider: PROVIDER_AERODATABOX.into(),
            gateway: AERODATABOX_GATEWAY_RAPID_API.into(),
            api_key: Some("very-secret-key-1234".into()),
            updated_at: Some("2026-06-05T00:00:00Z".into()),
        });

        assert_eq!(public_config.gateway, AERODATABOX_GATEWAY_RAPID_API);
        assert!(public_config.has_api_key);
        assert_eq!(public_config.api_key_preview.as_deref(), Some("********1234"));
    }

    #[test]
    fn mask_api_key_preview_uses_suffix_only() {
        assert_eq!(mask_api_key_preview("abcd1234"), "********1234");
    }

    #[test]
    fn validate_flight_data_source_provider_rejects_unknown_values() {
        assert!(validate_flight_data_source_provider(PROVIDER_MOCK).is_ok());
        assert!(validate_flight_data_source_provider(PROVIDER_AERODATABOX).is_ok());
        assert!(validate_flight_data_source_provider("other").is_err());
    }

    #[test]
    fn validate_flight_data_source_gateway_rejects_unknown_values() {
        assert!(validate_flight_data_source_gateway(AERODATABOX_GATEWAY_API_MARKET).is_ok());
        assert!(validate_flight_data_source_gateway(AERODATABOX_GATEWAY_RAPID_API).is_ok());
        assert!(validate_flight_data_source_gateway("other").is_err());
    }
}
