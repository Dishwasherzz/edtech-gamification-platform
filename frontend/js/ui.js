export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
export function element(html) { const root = document.createElement("section"); root.innerHTML = html; return root; }
export function showError(root, error) {
  const target = root.querySelector("[data-error]");
  if (target) { target.textContent = error.message || String(error); target.hidden = false; }
}
export function progressBar(percent, label) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  return `<div class="progress" role="progressbar" aria-label="${escapeHtml(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}"><div style="width:${value}%"></div></div>`;
}
// Escape first: a small Markdown subset, never raw HTML or executable links.
export function markdown(text) {
  return String(text).split(/\r?\n\s*\r?\n/).map(block => {
    const match = block.match(/^(#{1,3})\s+([\s\S]*)$/);
    const tag = match ? `h${match[1].length + 1}` : "p";
    const safe = escapeHtml(match ? match[2] : block).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\r?\n/g, "<br>");
    return `<${tag}>${safe}</${tag}>`;
  }).join("");
}
export const statusName = status => ({ Completed: "Пройдена", Available: "Доступна", Locked: "Закрыта", Active: "В процессе", Passed: "Победа", Failed: "Поражение", Abandoned: "Попытка прекращена" })[status] || status;
export const modeName = mode => mode === "Boss" ? "Тест · Бой с боссом" : "Авария · QTE";
export const date = value => value ? new Date(value).toLocaleString("ru-RU") : "—";
