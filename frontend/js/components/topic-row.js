import { escapeHtml as e, statusName as defaultStatusName } from "../ui.js";
import { buttonAction } from "./button.js";

// Строка темы в маршруте курса: номер, название, статус и действие справа.
// Общая для dashboard.js и topics.js: раньше дублировалась в обоих файлах.
export function topicRow(topic, index, { statusName = defaultStatusName } = {}) {
  const status = topic.status ?? "Available";
  const locked = status === "Locked";
  const action = status === "Completed" ? "Повторить тему"
    : status === "Available" ? "Открыть тему"
      : "Недоступно";
  const hint = locked
    ? `Сначала завершите тему ${index}`
    : topic.subtitle ?? topic.description;
  const href = `#/topic/${e(topic.id)}`;
  const statusText = statusName ? statusName(status) : status;
  const aside = locked
    ? `<span class="status">${e(statusText)}</span>
       ${buttonAction({ label: action, kind: "small-button", disabled: true })}`
    : `<span class="status strong">${e(statusText)}</span>
       <a class="link action-link" href="${href}">${e(action)}</a>`;
  const title = locked
    ? `<h3 class="topic-title">${e(topic.title)}</h3>`
    : `<h3 class="topic-title"><a class="topic-row-link" href="${href}">${e(topic.title)}</a></h3>`;

  return `
    <div class="topic-row${locked ? " locked" : ""}"${locked ? ' aria-disabled="true"' : ""}>
      <span class="num subtle">${topic.sortOrder ?? index + 1}</span>
      <div>
        ${title}
        <p class="small">${e(hint ?? "")}</p>
      </div>
      <div class="topic-aside">${aside}</div>
    </div>`;
}
