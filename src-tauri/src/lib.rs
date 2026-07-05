mod settings;
mod vault;

use std::sync::Mutex;

use vault::VaultState;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(VaultState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            vault::pick_vault,
            vault::initial_vault,
            vault::list_tree,
            vault::read_note,
            vault::write_note,
            vault::create_note,
            vault::rename_path,
            vault::delete_path,
            settings::get_settings,
            settings::save_settings,
            settings::save_editor_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
