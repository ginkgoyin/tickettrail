use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TicketLocationPayload {
    pub name: String,
    pub code: Option<String>,
    pub timezone: String,
}

#[allow(dead_code)]
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JourneyCompanionPayload {
    pub id: String,
    pub journey_id: String,
    pub name: String,
    pub created_at: String,
}

#[allow(dead_code)]
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JourneyTicketPayload {
    pub id: String,
    pub journey_id: String,
    pub ticket_id: String,
    pub created_at: String,
}

#[allow(dead_code)]
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JourneyPayload {
    pub id: String,
    pub title: String,
    pub destination: Option<String>,
    pub date_mode: String,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub notes: Option<String>,
    pub rating: Option<i64>,
    pub mood: Option<String>,
    pub cost_amount: Option<f64>,
    pub cost_currency: Option<String>,
    pub lodging: Option<String>,
    pub companions: Vec<JourneyCompanionPayload>,
    pub ticket_ids: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[allow(dead_code)]
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JourneyMutationPayload {
    pub title: String,
    pub destination: Option<String>,
    pub date_mode: String,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub notes: Option<String>,
    pub rating: Option<i64>,
    pub mood: Option<String>,
    pub cost_amount: Option<f64>,
    pub cost_currency: Option<String>,
    pub lodging: Option<String>,
    #[serde(default)]
    pub companion_names: Vec<String>,
    #[serde(default)]
    pub ticket_ids: Vec<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TicketDraftPayload {
    pub ticket_type: String,
    pub carrier_name: String,
    pub code: String,
    pub departure: TicketLocationPayload,
    pub arrival: TicketLocationPayload,
    pub departure_terminal: Option<String>,
    pub arrival_terminal: Option<String>,
    pub departure_time_local: String,
    pub arrival_time_local: String,
    pub class_info: String,
    pub seat_info: String,
    pub notes: String,
    pub segments: Option<Vec<TicketSegmentPayload>>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TicketSegmentPayload {
    pub carrier_name: String,
    pub code: String,
    pub departure: TicketLocationPayload,
    pub arrival: TicketLocationPayload,
    pub departure_terminal: Option<String>,
    pub arrival_terminal: Option<String>,
    pub departure_time_local: String,
    pub arrival_time_local: String,
    pub class_info: String,
    pub seat_info: String,
    pub notes: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TicketRecordPayload {
    pub id: String,
    pub ticket_type: String,
    pub carrier_name: String,
    pub code: String,
    pub departure: TicketLocationPayload,
    pub arrival: TicketLocationPayload,
    pub departure_terminal: Option<String>,
    pub arrival_terminal: Option<String>,
    pub departure_time_local: String,
    pub arrival_time_local: String,
    pub class_info: String,
    pub seat_info: String,
    pub notes: String,
    pub route_label: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    pub segments: Option<Vec<TicketSegmentPayload>>,
    pub segment_count: usize,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TicketAttachmentUploadPayload {
    pub file_name: String,
    pub mime_type: String,
    pub bytes: Vec<u8>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TicketAttachmentPayload {
    pub id: String,
    pub ticket_id: String,
    pub file_name: String,
    pub mime_type: String,
    pub file_size: u64,
    pub created_at: String,
    pub file_path: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MapPointPayload {
    pub label: String,
    pub code: Option<String>,
    pub timezone: String,
    pub latitude: f64,
    pub longitude: f64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MapViewportPayload {
    pub min_latitude: f64,
    pub max_latitude: f64,
    pub min_longitude: f64,
    pub max_longitude: f64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MapRoutePayload {
    pub line_label: String,
    pub direction_hint: String,
    pub distance_hint_km: u32,
    pub origin: MapPointPayload,
    pub destination: MapPointPayload,
    pub viewport: MapViewportPayload,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MapSegmentPayload {
    pub segment_index: usize,
    pub transport_type: String,
    pub carrier_name: String,
    pub code: String,
    pub line_label: String,
    pub direction_hint: String,
    pub distance_hint_km: u32,
    pub origin: MapPointPayload,
    pub destination: MapPointPayload,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StubPreviewPayload {
    pub title: String,
    pub subtitle: String,
    pub transport_badge: String,
    pub primary_code: String,
    pub departure_label: String,
    pub departure_terminal: Option<String>,
    pub departure_time_local: String,
    pub arrival_label: String,
    pub arrival_terminal: Option<String>,
    pub arrival_time_local: String,
    pub carrier_name: String,
    pub seat_label: String,
    pub notes: String,
    pub route_label: String,
    pub accent: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TicketDetailPayload {
    pub ticket: TicketRecordPayload,
    pub map: MapRoutePayload,
    pub segments: Vec<MapSegmentPayload>,
    pub stub: StubPreviewPayload,
    pub attachments: Vec<TicketAttachmentPayload>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AirlinePayload {
    pub id: String,
    pub iata_code: String,
    pub icao_code: Option<String>,
    pub name_en: String,
    pub name_zh: Option<String>,
    pub aliases: Vec<String>,
    pub country_code: Option<String>,
    pub logo_key: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocationDirectoryPayload {
    pub id: String,
    pub location_type: String,
    pub code: Option<String>,
    pub name_zh: Option<String>,
    pub name_en: Option<String>,
    pub aliases: Vec<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub timezone: Option<String>,
    pub country_code: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupRecordPayload {
    pub id: String,
    pub label: String,
    pub created_at: String,
    pub ticket_count: usize,
    pub attachment_count: usize,
    pub database_size_bytes: u64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupReadinessPayload {
    pub database_exists: bool,
    pub database_path: String,
    pub attachment_root_path: String,
    pub ticket_count: usize,
    pub attachment_count: usize,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportFolderPayload {
    pub path: String,
    pub resolution_kind: String,
    pub is_exact: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FlightLookupRequestPayload {
    pub flight_number: String,
    pub date: String,
    pub provider: String,
    pub locale: Option<String>,
    pub departure_airport_hint: Option<String>,
    pub arrival_airport_hint: Option<String>,
    pub country_hint: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FlightLookupLocationPayload {
    pub name: String,
    pub code: String,
    pub timezone: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FlightLookupCandidatePayload {
    pub id: String,
    pub provider: String,
    pub provider_label: String,
    pub source_note: String,
    pub carrier_name: String,
    pub code: String,
    pub departure: FlightLookupLocationPayload,
    pub arrival: FlightLookupLocationPayload,
    pub departure_terminal: Option<String>,
    pub arrival_terminal: Option<String>,
    pub departure_time_local: String,
    pub arrival_time_local: String,
    pub aircraft: Option<String>,
    pub flight_status: Option<String>,
    pub confidence: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FlightDataSourceConfigPayload {
    pub provider: String,
    pub gateway: String,
    pub has_api_key: bool,
    pub api_key_preview: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FlightDataSourceConfigSavePayload {
    pub provider: String,
    pub gateway: Option<String>,
    pub api_key: Option<String>,
    pub clear_api_key: Option<bool>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FlightLookupErrorPayload {
    pub code: String,
    pub message: String,
    pub provider: Option<String>,
    pub retryable: bool,
    pub details: Option<String>,
}
