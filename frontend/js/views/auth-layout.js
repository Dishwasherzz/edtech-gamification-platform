import { element, escapeHtml as e, showError, clearError } from "../ui.js";

// Общая разметка для входа и регистрации: слева — рассказ и персонаж, справа — карточка формы.
export function authLayout({ pageTitle, panelTitle, formHtml, altHtml = "", steps = [], tabs = "", story = "" }) {
  return element(`
    <div class="auth-layout">
      <section class="auth-story">
        ${steps.length ? `<div class="step-line">${steps.map((step, index) => `
          <span class="${index === 0 ? "selected" : ""}">${e(step)}</span>${index < steps.length - 1 ? '<span aria-hidden="true">→</span>' : ""}`).join("")}</div>
          <div class="gap"></div>` : ""}
        <h1>${e(pageTitle)}</h1>
        <p class="muted">${e(story)}</p>
        <div class="sprite sprite--male-full" role="img" aria-label="Персонаж курса" style="width:112px;height:284px"></div>
      </section>

      <section class="auth-card" aria-label="${e(panelTitle)}">
        ${tabs ? `<div class="auth-tabs">${tabs}</div>` : ""}
        ${formHtml}
        ${altHtml}
      </section>
    </div>
  `);
}

export function field({ label, name, type = "text", placeholder, autocomplete = "off", max = 128, hint = "", required = true }) {
  const described = hint ? ` ${e(name)}-hint` : "";
  return `
    <div class="field">
      <span class="field-label">${e(label)}</span>
      <div class="field-value">
        <input name="${e(name)}" type="${e(type)}" placeholder="${e(placeholder)}" autocomplete="${e(autocomplete)}"
               maxlength="${max}"${required ? " required" : ""}${described ? ` aria-describedby="${e(name)}-hint"` : ""}>
      </div>
      ${hint ? `<span class="field-note" id="${e(name)}-hint" data-hint="${e(name)}">${e(hint)}</span>` : ""}
    </div>
  `;
}

// Поле с кнопкой «Показать» для пароля.
export function passwordField({ label, name, placeholder, autocomplete = "current-password", hint = "" }) {
  const described = hint ? ` ${e(name)}-hint` : "";
  return `
    <div class="field field-password">
      <span class="field-label">${e(label)}</span>
      <div class="field-value">
        <input name="${e(name)}" type="password" placeholder="${e(placeholder)}" autocomplete="${e(autocomplete)}"
               maxlength="128" required${hint ? ` aria-describedby="${e(name)}-hint"` : ""}>
        <a class="action-link reveal" data-reveal href="#">Показать</a>
      </div>
      ${hint ? `<span class="field-note" id="${e(name)}-hint" data-hint="${e(name)}">${e(hint)}</span>` : ""}
    </div>
  `;
}

// Отметка о согласии: чекбокс, ссылка на документ и причина недоступности.
// Порядок строк — как в макете: отметка, ссылка на документ, подсказка, объяснение.
export function consentField({ name = "consent", label = "Я даю согласие на обработку персональных данных",
  linkText = "Прочитать согласие", linkHref = "#/consent", hint = "" }) {
  return `
    <div class="consent">
      <div class="check-row">
        <span class="checkbox" data-check><input type="checkbox" name="${e(name)}" value="yes" style="display:none;position:absolute"></span>
        <span>${e(label)}</span>
      </div>
      <a class="link action-link" href="${e(linkHref)}">${e(linkText)}</a>
      <p class="small" data-consent-hint>${e(hint)}</p>
      <a class="link action-link" data-why>${e(linkText === "Прочитать согласие" ? "Зачем нужно согласие" : "Зачем нужно согласие")}</a>
    </div>
  `;
}

// Форма блокируется на время запроса, чтобы не отправить его дважды.
export function bindForm(root, onSubmit) {
  const form = root.querySelector("form");
  const fieldset = form.querySelector("fieldset");
  const button = form.querySelector('button[type="submit"]');

  form.onsubmit = async event => {
    event.preventDefault();
    if (fieldset.disabled || !form.reportValidity()) return;
    // Disabled controls are omitted by FormData, so read them before locking the form.
    const values = new FormData(form);
    fieldset.disabled = true;
    clearError(root);
    const label = button.textContent;
    button.textContent = "Отправка…";
    try {
      await onSubmit(values);
    } catch (error) {
      showError(root, error);
      // Сервер не различает поля в тексте ошибки: подсвечиваем все заполненные.
      form.querySelectorAll("input").forEach(input => input.setAttribute("aria-invalid", "true"));
    } finally {
      fieldset.disabled = false;
      button.textContent = label;
    }
  };

  // Пока пользователь правит поле, снимаем подсветку ошибки.
  form.addEventListener("input", event => {
    event.target.removeAttribute("aria-invalid");
    clearError(root);
  });

  // «Показать» переключает видимость пароля.
  root.querySelectorAll("[data-reveal]").forEach(button => {
    button.onclick = event => {
      event.preventDefault();
      const input = button.parentElement.querySelector("input");
      const shown = input.type === "text";
      input.type = shown ? "password" : "text";
      button.textContent = shown ? "Показать" : "Скрыть";
      button.setAttribute("aria-pressed", String(!shown));
    };
  });

  // Чекбокс согласия: заливка при отметке.
  root.querySelectorAll("[data-check]").forEach(box => {
    const input = box.querySelector("input");
    if (!input) return;
    const sync = () => box.classList.toggle("checked", input.checked);
    input.addEventListener("change", sync);
    sync();
  });

  return root;
}

