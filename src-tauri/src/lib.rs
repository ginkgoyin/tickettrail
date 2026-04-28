mod commands;
mod db;
mod models;

use commands::{create_stub_preview, create_ticket, get_bootstrap_summary, list_tickets};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_bootstrap_summary,
            list_tickets,
            create_ticket,
            create_stub_preview
        ])
        .run(tauri::generate_context!())
        .expect("error while running TicketTrail application");
}
