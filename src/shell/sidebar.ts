interface ShellState {
  sidebarVisible: boolean;
}

const state: ShellState = { sidebarVisible: true };

export function toggleSidebar(): void {
  state.sidebarVisible = !state.sidebarVisible;
  document
    .getElementById("sidebar")
    ?.classList.toggle("hidden", !state.sidebarVisible);
  document
    .getElementById("sidebar-toggle")
    ?.setAttribute("aria-expanded", String(state.sidebarVisible));
}

export function initSidebar(root: HTMLElement): void {
  root
    .querySelector<HTMLButtonElement>("#sidebar-toggle")
    ?.addEventListener("click", toggleSidebar);

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "b") {
      e.preventDefault();
      toggleSidebar();
    }
  });
}
