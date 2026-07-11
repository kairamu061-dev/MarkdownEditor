import { getCurrentWindow } from "@tauri-apps/api/window";

/** カスタムタイトルバーの最小化/最大化/閉じるボタンを配線する（フレームレスウィンドウ） */
export function initTitlebar(): void {
  let appWindow;
  try {
    appWindow = getCurrentWindow();
  } catch {
    // Tauri ランタイム外（ブラウザ単体プレビュー等）では何もしない
    return;
  }

  const minimize = document.getElementById("win-minimize");
  const maximize = document.getElementById("win-maximize");
  const close = document.getElementById("win-close");

  minimize?.addEventListener("click", () => void appWindow.minimize());
  close?.addEventListener("click", () => void appWindow.close());
  maximize?.addEventListener("click", () => void appWindow.toggleMaximize());

  // 最大化状態に応じてアイコンを ▢（最大化）/ ❐（元に戻す）で切り替える
  const syncMaximizeIcon = async () => {
    if (!maximize) return;
    try {
      const isMax = await appWindow.isMaximized();
      maximize.textContent = isMax ? "❐" : "▢";
      maximize.title = isMax ? "元に戻す" : "最大化";
    } catch {
      /* 権限やランタイムの都合で取得できない場合は既定表示のまま */
    }
  };
  void syncMaximizeIcon();
  void appWindow.onResized(() => void syncMaximizeIcon());
}
