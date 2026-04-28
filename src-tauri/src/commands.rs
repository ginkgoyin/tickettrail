use crate::{
    db,
    models::{StubPreview, TicketDraftPayload, TicketRecordPayload},
};
use tauri::command;
use tauri::AppHandle;

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
pub fn create_ticket(
    app: AppHandle,
    draft: TicketDraftPayload,
) -> Result<TicketRecordPayload, String> {
    db::create_ticket(&app, draft)
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
