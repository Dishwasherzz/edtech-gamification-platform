import { api } from "../api.js";
import { state, clearSession, refreshProfile, setMascotVisible } from "../state.js";
import { element, escapeHtml as e, askDialog } from "../ui.js";
import { assetUrl, mascotAsset } from "../assets.js";

// Правила Identity на сервере: длина от 8 символов, строчная и заглавная буквы, цифра.
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[\S]{8,128}$/;
const TABS = [
  { key: "account", label: "Аккаунт" },
  { key: "password", label: "Пароль" },
  { key: "mascot", label: "Спутник" },
  { key: "data", label: "Персональные данные" }
];

function mascotCard(mascot, current, user) {
  const image = assetUrl(mascotAsset(user, mascot));
  return `
    <label class="character-card${mascot.id === current ? " selected" : ""}" data-mascot="${e(mascot.id)}">
      <input type="radio" name="mascot" value="${e(mascot.id)}" ${mascot.id === current ? "checked" : ""}>
      <span class="character-art">
        <span class="sprite-img"${image ? ` style="background-image:url('${image}')"` : ""}></span>
      </span>
      <span class="character-name">
        <h2>${e(mascot.name)}</h2>
        <span class="checkbox${mascot.id === current ? " is-checked" : ""}" data-mark></span>
      </span>
      <span class="small" data-state>${mascot.id === current ? "✓ Выбран" : "Выбрать"}</span>
    </label>`;
}

export async function renderSettings(tab = "account") {
  const user = await refreshProfile();
  const active = TABS.some(item => item.key === tab) ? tab : "account";
  const mascots = await api.mascots().catch(() => []);

  const root = element(`
    <header class="page-head">
      <div><h1>Настройки профиля</h1><p>${e(TABS.find(item => item.key === active).label)}</p></div>
      <div class="top-actions"><a class="link action-link" href="#/profile">К профилю</a></div>
    </header>

    <div class="settings-layout">
      <nav class="settings-side" aria-label="Разделы настроек">
        ${TABS.map(item => `<button type="button" class="settings-item${item.key === active ? " selected" : ""}" data-tab="${item.key}"><span>${e(item.label)}</span></button>`).join("")}
      </nav>

      <div class="settings-content">
        <section class="card" data-panel="account" ${active === "account" ? "" : "hidden"}>
          <h2>Никнейм и почта</h2>
          <p data-error class="error" role="alert" hidden></p>
          <div class="tight">
            <label class="field">
              <span>Никнейм</span>
              <input name="displayName" type="text" maxlength="20" value="${e(user.displayName)}" autocomplete="nickname" required>
              <span class="field-note">От 3 до 20 букв, цифр, дефисов или подчёркиваний.</span>
            </label>
            <label class="field">
              <span>Электронная почта</span>
              <input name="email" type="email" value="${e(user.email ?? "")}" readonly>
              <span class="field-note">Почта используется для входа и восстановления</span>
            </label>
          </div>
          <div class="actions"><button type="button" class="btn" data-save-nickname>Сохранить изменения</button></div>
          <p class="success" data-status role="status"></p>

          <div class="rule"></div>

          <h2>Персонаж</h2>
          <div class="settings-row">
            <p>Сейчас: ${e(user.hero?.name ?? "не выбран")}. Выбор не меняет задания или награды.</p>
            <a class="link action-link" href="#/character">Сменить персонажа</a>
          </div>
        </section>

        <section class="card" data-panel="password" ${active === "password" ? "" : "hidden"}>
          <h2>Смена пароля</h2>
          <p data-error class="error" role="alert" hidden></p>
          <div class="tight">
            <label class="field field-password">
              <span>Текущий пароль</span>
              <span class="field-row">
                <input name="currentPassword" type="password" maxlength="128" autocomplete="current-password" required>
              </span>
              <span class="field-note" data-hint="currentPassword"></span>
            </label>
            <label class="field field-password">
              <span>Новый пароль</span>
              <span class="field-row">
                <input name="newPassword" type="password" maxlength="128" autocomplete="new-password" required>
                <button type="button" class="reveal" data-reveal aria-pressed="false">Показать</button>
              </span>
              <span class="field-note">От 8 символов, строчная и заглавная буквы, цифра.</span>
            </label>
          </div>
          <div class="actions"><button type="button" class="btn" data-save-password>Сохранить пароль</button></div>
          <p class="success" data-status role="status"></p>
        </section>

        <section class="card" data-panel="mascot" ${active === "mascot" ? "" : "hidden"}>
          <h2>Видимость спутника</h2>
          <p data-error class="error" role="alert" hidden></p>
          <div class="settings-row">
            <div>
              <span class="switch-label">Показывать спутника</span>
              <p>${state.mascotVisible
                ? "Включено · подсказки по запросу"
                : "Выключено · курс и награды без изменений. Спутник и его пункт меню скрыты."}</p>
            </div>
            <label class="switch">
              <input type="checkbox" data-mascot-visible ${state.mascotVisible ? "checked" : ""}>
              <span class="toggle${state.mascotVisible ? " on" : ""}"><span></span></span>
            </label>
          </div>

          <div class="rule"></div>

          <h2>Персонаж</h2>
          <div class="settings-row">
            <p>Внешность не меняет механику курса. Сейчас: ${e(user.hero?.name ?? "не выбран")}.</p>
            <a class="link action-link" href="#/character">Сменить персонажа</a>
          </div>

          <div class="rule"></div>

          <h2>Маскот</h2>
          <p class="muted">Маскот даёт подсказки по экрану и реагирует на события испытания.</p>
          ${mascots.length ? `<div class="character-choice">${mascots.map(item => mascotCard(item, user.mascot?.id, user)).join("")}</div>`
            : `<p class="muted">Маскоты пока не настроены на сервере.</p>`}
          <div class="actions"><button type="button" class="btn" data-save-mascot ${mascots.length ? "" : "disabled"}>Сохранить маскота</button></div>
        </section>

        <section class="card" data-panel="data" ${active === "data" ? "" : "hidden"}>
          <h2>Персональные данные</h2>
          <p data-error class="error" role="alert" hidden></p>
          <p class="muted">Сведения об аккаунте и прохождении курса не видны другим пользователям.</p>
          <div class="settings-row">
            <p>Прочитать согласие на обработку данных.</p>
            <a class="link action-link" href="#/consent">Читать согласие</a>
          </div>
          <div class="settings-row">
            <p>Отзыв согласия — это удаление аккаунта: доступ, история испытаний и накопленный прогресс будут утрачены.</p>
            <span class="status">Отзыв через удаление</span>
          </div>

          <div class="rule"></div>

          <h2>Удаление аккаунта</h2>
          <p class="muted">После подтверждения доступ и сохранённый прогресс будут утрачены.</p>
          <div class="actions"><button type="button" class="btn is-error" data-delete>Удалить аккаунт</button></div>

          <div class="danger-zone" data-delete-panel hidden>
            <h3>Удалить аккаунт?</h3>
            <p class="muted">Вы потеряете доступ к аккаунту, истории испытаний и накопленному прогрессу. Отменить удаление после подтверждения нельзя.</p>
            <label class="field field-password">
              <span>Пароль</span>
              <span class="field-row">
                <input name="deletePassword" type="password" maxlength="128" autocomplete="current-password">
                <button type="button" class="reveal" data-reveal aria-pressed="false">Показать</button>
              </span>
              <span class="field-note" data-hint="deletePassword"></span>
            </label>
            <div class="actions">
              <button type="button" class="btn is-error" data-delete-confirm>Подтвердить удаление</button>
              <button type="button" class="btn btn-outline" data-delete-cancel>Отмена</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  `);

  /* --- Переключение разделов ---------------------------------------- */
  root.querySelectorAll("[data-tab]").forEach(button => {
    button.onclick = () => {
      const key = button.dataset.tab;
      root.querySelectorAll("[data-tab]").forEach(other => other.classList.toggle("selected", other === button));
      root.querySelectorAll("[data-panel]").forEach(panel => { panel.hidden = panel.dataset.panel !== key; });
      history.replaceState(null, "", `#/settings?tab=${key}`);
    };
  });

  /* --- Аккаунт ------------------------------------------------------ */
  const nicknameButton = root.querySelector("[data-save-nickname]");
  nicknameButton.onclick = async () => {
    const form = root.querySelector("[data-panel='account']");
    const input = form.querySelector("input[name='displayName']");
    const status = form.querySelector("[data-status]");
    const error = form.querySelector("[data-error]");
    error.hidden = true;
    status.textContent = "";
    nicknameButton.disabled = true;
    try {
      await api.updateNickname(input.value.trim());
      await refreshProfile();
      status.textContent = "Никнейм сохранён. Изменение появится в профиле.";
    } catch (problem) {
      error.textContent = problem.message;
      error.hidden = false;
    } finally {
      nicknameButton.disabled = false;
    }
  };

  /* --- Пароль ------------------------------------------------------- */
  root.querySelectorAll("[data-reveal]").forEach(button => {
    button.onclick = () => {
      const input = button.parentElement.querySelector("input");
      const shown = input.type === "text";
      input.type = shown ? "password" : "text";
      button.textContent = shown ? "Показать" : "Скрыть";
      button.setAttribute("aria-pressed", String(!shown));
    };
  });

  const passwordButton = root.querySelector("[data-save-password]");
  passwordButton.onclick = async () => {
    const form = root.querySelector("[data-panel='password']");
    const current = form.querySelector("input[name='currentPassword']").value;
    const next = form.querySelector("input[name='newPassword']").value;
    const status = form.querySelector("[data-status]");
    const error = form.querySelector("[data-error]");
    const hint = form.querySelector("[data-hint='currentPassword']");
    error.hidden = true;
    status.textContent = "";
    hint.textContent = "";
    hint.classList.remove("error");

    if (!current) { hint.textContent = "Введите текущий пароль."; hint.classList.add("error"); return; }
    if (!PASSWORD_RULE.test(next)) {
      hint.textContent = "Новый пароль: от 8 символов, строчная и заглавная буквы, цифра.";
      hint.classList.add("error");
      return;
    }
    if (current === next) {
      hint.textContent = "Новый пароль должен отличаться от текущего.";
      hint.classList.add("error");
      return;
    }

    passwordButton.disabled = true;
    try {
      await api.updatePassword(current, next);
      form.querySelectorAll("input").forEach(input => { input.value = ""; });
      status.textContent = "Пароль изменён. Используйте новый пароль для входа.";
    } catch (problem) {
      error.textContent = problem.message;
      error.hidden = false;
    } finally {
      passwordButton.disabled = false;
    }
  };

  /* --- Спутник ------------------------------------------------------ */
  const visibleBox = root.querySelector("[data-mascot-visible]");
  const toggle = root.querySelector(".toggle");
  visibleBox.onchange = () => {
    setMascotVisible(visibleBox.checked);
    toggle.classList.toggle("on", visibleBox.checked);
    const note = root.querySelector("[data-panel='mascot'] .settings-row p");
    note.textContent = visibleBox.checked
      ? "Включено · подсказки по запросу"
      : "Выключено · курс и награды без изменений. Спутник и его пункт меню скрыты.";
  };

  let mascotId = user.mascot?.id ?? null;
  root.querySelectorAll("[data-mascot]").forEach(card => {
    card.onclick = () => {
      mascotId = card.dataset.mascot;
      root.querySelectorAll("[data-mascot]").forEach(other => {
        const checked = other === card;
        other.classList.toggle("selected", checked);
        other.querySelector("input").checked = checked;
        other.querySelector("[data-mark]").classList.toggle("is-checked", checked);
        other.querySelector("[data-state]").textContent = checked ? "✓ Выбран" : "Выбрать";
      });
    };
  });

  const mascotButton = root.querySelector("[data-save-mascot]");
  mascotButton.onclick = async () => {
    const error = root.querySelector("[data-panel='mascot'] [data-error]");
    error.hidden = true;
    if (!mascotId) return;
    mascotButton.disabled = true;
    try {
      await api.selectMascot(mascotId);
      await refreshProfile();
      error.className = "success";
      error.textContent = "Маскот сохранён.";
      error.hidden = false;
    } catch (problem) {
      error.className = "error";
      error.textContent = problem.message;
      error.hidden = false;
    } finally {
      mascotButton.disabled = false;
    }
  };

  /* --- Удаление аккаунта -------------------------------------------- */
  const deleteButton = root.querySelector("[data-delete]");
  const deletePanel = root.querySelector("[data-delete-panel]");
  deleteButton.onclick = async () => {
    const answer = await askDialog({
      title: "Удалить аккаунт?",
      body: "<p>Вы потеряете доступ к аккаунту, истории испытаний и накопленному прогрессу. Отменить удаление после подтверждения нельзя.</p>",
      actions: [
        { label: "Подтвердить удаление", value: "delete", kind: "is-error" },
        { label: "Отмена", value: "cancel", kind: "btn-outline" }
      ]
    });
    if (answer !== "delete") return;
    deletePanel.hidden = false;
    deletePanel.querySelector("input").focus();
  };

  root.querySelector("[data-delete-cancel]").onclick = () => { deletePanel.hidden = true; };
  root.querySelector("[data-delete-confirm]").onclick = async event => {
    const panel = root.querySelector("[data-delete-panel]");
    const password = panel.querySelector("input[name='deletePassword']").value;
    const hint = panel.querySelector("[data-hint='deletePassword']");
    const error = root.querySelector("[data-panel='data'] [data-error]");
    hint.textContent = "";
    hint.classList.remove("error");
    error.hidden = true;
    if (!password) {
      hint.textContent = "Для удаления аккаунта введи пароль.";
      hint.classList.add("error");
      return;
    }
    event.target.disabled = true;
    try {
      await api.deleteAccount(password);
      clearSession();
      window.location.hash = "#/account/deleted";
    } catch (problem) {
      error.textContent = `Не удалось отправить запрос. ${problem.message} Аккаунт и данные пока не удалены.`;
      error.hidden = false;
      event.target.disabled = false;
    }
  };

  return root;
}

// Запрос на удаление принят: аккаунт и сессия завершены.
export function renderAccountDeleted() {
  return element(`
    <header class="page-head">
      <div><h1>Запрос принят</h1><p>Удаление аккаунта</p></div>
    </header>

    <section class="card">
      <h2>Удаление аккаунта</h2>
      <p class="muted">Вы вышли из аккаунта. Порядок и сроки обработки запроса будут указаны в согласованном тексте оператора.</p>
      <div class="actions"><a class="btn" href="#/">На главную</a></div>
    </section>
  `);
}
