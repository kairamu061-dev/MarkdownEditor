fn main() {
    // tauri-build embeds icons/icon.ico into the Windows executable as resource
    // 32512 (tauri-build 2.6.3, src/lib.rs:669), but it only emits rerun-if-changed
    // for tauri.conf.json — not for the icon files themselves. Without this line,
    // replacing an icon leaves the build script's cached output in place and the exe
    // keeps the old icon, even though the running app's window/taskbar icon updates.
    // Watching the directory covers both the .ico (executable resource) and the PNGs
    // consumed by generate_context!. See BUG-024.
    println!("cargo:rerun-if-changed=icons");

    tauri_build::build()
}
