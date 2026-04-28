use crate::models::{StubPreview, TicketSummary};
use tauri::command;

#[command]
pub fn get_bootstrap_summary() -> String {
    "TicketTrail scaffold ready: React frontend, Tauri shell, Rust commands, and SQLite schema.".to_string()
}

#[command]
pub fn list_sample_tickets() -> Vec<TicketSummary> {
    vec![
        TicketSummary {
            id: "ticket-pvg-syd".into(),
            ticket_type: "flight".into(),
            carrier_name: "China Eastern".into(),
            code: "MU561".into(),
            departure_name: "Shanghai Pudong".into(),
            arrival_name: "Sydney Airport".into(),
        },
        TicketSummary {
            id: "ticket-shhq-nj".into(),
            ticket_type: "train".into(),
            carrier_name: "China Railway".into(),
            code: "G7012".into(),
            departure_name: "Shanghai Hongqiao".into(),
            arrival_name: "Nanjing South".into(),
        },
    ]
}

#[command]
pub fn create_stub_preview(code: String, route_label: String) -> StubPreview {
    StubPreview {
        title: "Ticket Stub Preview".into(),
        subtitle: format!("Reference {}", code),
        route_label,
        accent: "#70d4ff".into(),
    }
}
