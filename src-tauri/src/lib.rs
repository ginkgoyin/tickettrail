mod commands;
mod db;
mod flight_lookup;
mod models;

use commands::{
    add_ticket_attachment, create_backup, create_stub_preview, create_ticket, delete_ticket,
    delete_ticket_attachment, export_archive_bundle, export_backup, get_backup_readiness,
    get_bootstrap_summary, get_flight_data_source_config, get_ticket_detail, import_archive_bundle,
    list_backups, list_tickets, lookup_flight_candidates, restore_backup,
    save_flight_data_source_config, search_airlines, search_locations, update_ticket,
    update_ticket_status,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_bootstrap_summary,
            list_tickets,
            create_ticket,
            update_ticket,
            update_ticket_status,
            delete_ticket,
            add_ticket_attachment,
            delete_ticket_attachment,
            get_ticket_detail,
            search_airlines,
            search_locations,
            get_flight_data_source_config,
            save_flight_data_source_config,
            lookup_flight_candidates,
            list_backups,
            create_backup,
            get_backup_readiness,
            restore_backup,
            export_backup,
            export_archive_bundle,
            import_archive_bundle,
            create_stub_preview
        ])
        .run(tauri::generate_context!())
        .expect("error while running TicketTrail application");
}
