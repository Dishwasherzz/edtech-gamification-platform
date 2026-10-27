import { element, showError } from "../ui.js";

// Общая разметка для входа и регистрации: заголовок страницы с розовой чертой,
// цветные засечки по углам рамки, схема слева и форма справа.
export function authLayout({ pageTitle, panelTitle, formHtml, altHtml = "" }) {
  return element(`
    <h1 class="page-title">${pageTitle}</h1>

    <div class="auth-layout">
      <div class="schematic">
        <p class="schematic-label">Доступ к учебному модулю</p>
        <div class="schematic-canvas"><span class="schematic-node"></span></div>
      </div>

      <section class="auth-panel">
        <h2>${panelTitle}</h2>
        <div class="panel-skeleton" aria-hidden="true"><i></i><i></i></div>
        ${formHtml}
        ${altHtml}
      </section>
    </div>
  `);
}

export function field({ label, name, type = "text", placeholder, autocomplete = "off", max = 128, hint = "" }) {
  return `
    <label class="field">
      <span>${label}</span>
      <input name="${name}" type="${type}" placeholder="${placeholder}" autocomplete="${autocomplete}"
             maxlength="${max}" aria-describedby="${name}-hint" required>
      <p class="field-hint" id="${name}-hint" data-hint="${name}">${hint}</p>
    </label>
  `;
}

// Форма блокируется на время запроса, чтобы не отправить его дважды.
export function bindForm(root, onSubmit) {
  const form = root.querySelector("form");
  const fieldset = form.querySelector("fieldset");
  const button = form.querySelector('button[type="submit"]');

  form.onsubmit = async event => {
    event.preventDefault();
    fieldset.disabled = true;
    clearError(root);
    const label = button.textContent;
    button.textContent = "Отправка…";
    try {
      await onSubmit(new FormData(form));
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

  return root;
}

function clearError(root) {
  const box = root.querySelector("[data-error]");
  if (box) { box.textContent = ""; box.hidden = true; }
}