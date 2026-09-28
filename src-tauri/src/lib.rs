use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_fs::FsExt;

/// PDFs passed on the command line (Explorer "Open with") before the UI was ready.
#[derive(Default)]
struct LaunchFiles(Mutex<Vec<String>>);

fn pdf_args(args: &[String], cwd: Option<&str>) -> Vec<PathBuf> {
    args.iter()
        .skip(1)
        .map(PathBuf::from)
        .map(|path| match cwd {
            Some(dir) if path.is_relative() => PathBuf::from(dir).join(path),
            _ => path,
        })
        .filter(|path| {
            path.is_file()
                && path
                    .extension()
                    .is_some_and(|ext| ext.eq_ignore_ascii_case("pdf"))
        })
        .collect()
}

/// Grants the webview read/write access to exactly these files, nothing else.
fn allow_files(app: &AppHandle, paths: Vec<PathBuf>) -> Vec<String> {
    let scope = app.fs_scope();
    paths
        .into_iter()
        .map(|path| {
            let _ = scope.allow_file(&path);
            path.to_string_lossy().into_owned()
        })
        .collect()
}

#[tauri::command]
fn take_launch_files(state: State<LaunchFiles>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be first: a second launch forwards its files here and exits.
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let files = allow_files(app, pdf_args(&args, Some(&cwd)));
            if !files.is_empty() {
                let _ = app.emit("open-files", files);
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let args: Vec<String> = std::env::args().collect();
            let files = allow_files(app.handle(), pdf_args(&args, None));
            app.manage(LaunchFiles(Mutex::new(files)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![take_launch_files])
        .run(tauri::generate_context!())
        .expect("error while running Bazure");
}
