import { state, setDisplayName } from "../state.js";
import { element } from "../ui.js";
import { field } from "./auth-layout.js";

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[\S]{10,128}$/;

// Серверных маршрутов для смены никнейма и пароля нет, и бэкенд не меняется.
// Никнейм обновляется в состоянии вкладки, пароль только проверяется на клиенте.
// Поэтому все сообщения прямо говорят, что изменение не сохраняется.
const NOT_SAVED = "Демо без сервера: изменение живёт только до обновления страницы.";

function bindForm(root, name, onSubmit) {
  const form = root.querySelector(`[data-form="${name}"]`);
  const status = form.querySelector("[data-status]");

  form.onsubmit = event => {
    event.preventDefault();
    const outcome = onSubmit(new FormData(form));
    status.textContent = outcome.message;
    status.className = outcome.ok ? "field-hint success" : "field-hint error";
    if (outcome.ok) form.reset();
  };

  form.addEventListener("input", () => {
    status.textContent = "";
    form.querySelectorAll("[aria-invalid]").forEach(input => input.removeAttribute("aria-invalid"));
  });

  return form;
}

export function renderSettings() {
  const root = element(`
    <h1 class="page-title">Настройки профиля</h1>

    <div class="split-2">
      <section class="card">
        <h2>Сменить никнейм</h2>
        <form novalidate data-form="nickname">
          ${field({
            label: "Никнейм",
            name: "displayName",
            placeholder: state.user?.displayName ?? "Как тебя показывают",
            autocomplete: "nickname",
            max: 80
          })}
          <p class="field-hint" data-status></p>
          <button type="submit" class="btn btn-cta">Сохранить никнейм</button>
        </form>
        <p class="muted">Никнейм виден в шапке, на главной и в профиле.</p>
      </section>

      <section class="card">
        <h2>Сменить пароль</h2>
        <form novalidate data-form="password">
          ${field({
            label: "Текущий пароль",
            name: "currentPassword",
            type: "password",
            placeholder: "••••••••",
            autocomplete: "current-password"
          })}
          ${field({
            label: "Новый пароль",
            name: "newPassword",
            type: "password",
            placeholder: "••••••••",
            autocomplete: "new-password",
            hint: "От 10 символов, строчная и заглавная буквы, цифра."
          })}
          <p class="field-hint" data-status></p>
          <button type="submit" class="btn">Сохранить пароль</button>
        </form>
        <p class="muted">Только форма. Смена пароля и его проверка выполняются сервером.</p>
      </section>
    </div>
  `);

  bindForm(root, "nickname", values => {
    const value = values.get("displayName").trim();
    if (!value) return { ok: false, message: "Введите никнейм." };
    if (value.length > 80) return { ok: false, message: "Не больше 80 символов." };
    if (value === state.user?.displayName) return { ok: false, message: "Никнейм уже такой." };

    setDisplayName(value);
    return { ok: true, message: `Никнейм изменён на «${value}». ${NOT_SAVED}` };
  });

  bindForm(root, "password", values => {
    const current = values.get("currentPassword");
    const next = values.get("newPassword");
    if (!current) return { ok: false, message: "Введите текущий пароль." };
    if (!PASSWORD_RULE.test(next))
      return { ok: false, message: "Новый пароль: от 10 символов, строчная и заглавная буквы, цифра." };
    if (current === next) return { ok: false, message: "Новый пароль должен отличаться от текущего." };
    return { ok: true, message: `Пароль прошёл проверку на клиенте. ${NOT_SAVED}` };
  });

  return root;
}