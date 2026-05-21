use crate::{
    db,
    models::{
        AirlinePayload, BackupReadinessPayload, BackupRecordPayload, LocationDirectoryPayload,
        StubPreviewPayload, TicketAttachmentPayload, TicketAttachmentUploadPayload, TicketDetailPayload,
        TicketDraftPayload, TicketRecordPayload,
    },
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
pub fn create_stub_preview(code: String, route_label: String) -> StubPreviewPayload {
    StubPreviewPayload {
        title: "Ticket Stub Preview".into(),
        subtitle: format!("Reference {}", code),
        transport_badge: "PREVIEW".into(),
        primary_code: code,
        departure_label: "Departure".into(),
        departure_time_local: "--".into(),
        arrival_label: "Arrival".into(),
        arrival_time_local: "--".into(),
        carrier_name: "Carrier".into(),
        seat_label: "TBD / TBD".into(),
        notes: "Preview payload".into(),
        route_label,
        accent: "#70d4ff".into(),
    }
}
