use serde::Serialize;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TicketSummary {
    pub id: String,
    pub ticket_type: String,
    pub carrier_name: String,
    pub code: String,
    pub departure_name: String,
    pub arrival_name: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StubPreview {
    pub title: String,
    pub subtitle: String,
    pub route_label: String,
    pub accent: String,
}
