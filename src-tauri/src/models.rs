use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TicketLocationPayload {
    pub name: String,
    pub code: Option<String>,
    pub timezone: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TicketDraftPayload {
    pub ticket_type: String,
    pub carrier_name: String,
    pub code: String,
    pub departure: TicketLocationPayload,
    pub arrival: TicketLocationPayload,
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
    pub departure_time_local: String,
    pub arrival_time_local: String,
    pub class_info: String,
    pub seat_info: String,
    pub notes: String,
    pub route_label: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StubPreview {
    pub title: String,
    pub subtitle: String,
    pub route_label: String,
    pub accent: String,
}
