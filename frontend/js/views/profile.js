import { api } from "../api.js";
import { refreshProfile } from "../state.js";
import { element, escapeHtml as e, progressBar, statusName, dateShort, shortModeName } from "../ui.js";
import { statsGrid } from "../components/stats-grid.js";
import { pageHead } from "../components/page-head.js";
import { panel } from "../components/panel.js";
import { actions } from "../components/actions.js";
import { historyTable } from "../components/history-table.js";
import { buttonEdge, buttonLink } from "../components/button.js";
import { mascotMini } from "../mascot.js";
import { companionCharacter, fullAsset, skinAsset } from "../assets.js";

export async function renderProfile(page = 1) {
  const active = await api.active();
  const [user, history, courses, rules] = await Promise.all([
    refreshProfile(),
    api.history(page),
    api.courses(),
    api.instructions().catch(() => ({}))
  ]);
  const ranks = rules.rankThresholds?.length ?? 0;

  const totals = courses.reduce((acc, course) => ({
    topics: acc.topics + course.totalTopics,
    done: acc.done + course.completedTopics
  }), { topics: 0, done: 0 });
  const percent = totals.topics ? Math.floor(totals.done * 100 / totals.topics) : 0;
  const nextCourse = courses.find(course => course.progressPercent < 100);

  const character = companionCharacter(user);
  const mascot = mascotMini({
    label: active ? "Спутник · Идёт испытание" : "Спутник · Готов к занятию",
    character,
    mood: active ? "focus" : "calm"
  });
  const skinImage = user.characterSkin ? skinAsset(user.characterSkin) : null;
  const heroImage = skinImage ?? fullAsset(character, "front");

  const root = element(`
    ${pageHead({
      title: "Профиль",
      description: `${e(user.displayName)}${user.email ? ` · ${e(user.email)}` : ""}`,
      actions: `${buttonLink({ href: "#/settings", label: "Настройки профиля", kind: "outline" })}
        ${buttonLink({ href: nextCourse ? "#/" : "#/instructions", label: "Продолжить обучение" })}`
    })}

    <div class="grid-main">
      <div class="stack">
        ${panel({
          children: `
            <div class="row">
              <div class="character-art ${character}">
                <img class="character-img character-full" src="${e(heroImage)}" alt="${e(user.displayName)}" width="80" height="88">
              </div>
              <div>
                <h2 style="margin-bottom:4px">${e(user.displayName)}</h2>
                <p class="small">${e(user.email ?? "")}</p>
              </div>
            </div>
            <div class="gap"></div>
            ${statsGrid({
              items: [
                { label: "Прогресс курса", value: percent, unit: "%" },
                { label: "Текущий разряд", value: user.rank, unit: ranks ? `из ${ranks}` : "" },
                { label: "Опыт", value: user.totalXp, unit: "XP" },
                { label: "Баланс", value: user.coinsBalance, unit: "монет" }
              ]
            })}
          `
        })}

        ${panel({
          title: "История испытаний",
          children: `
            ${historyTable(history)}
            ${page > 1 || history.length === 20 ? `${actions({ children: `
              ${page > 1 ? buttonLink({ href: `#/profile?page=${page - 1}`, label: "Назад", kind: "outline" }) : ""}
              ${history.length === 20 ? buttonLink({ href: `#/profile?page=${page + 1}`, label: "Дальше", kind: "outline" }) : ""}
            ` })}` : ""}
          `
        })}
      </div>

      <div class="stack">
        ${user.nextRankXp ? panel({
          title: "До следующего разряда",
          children: `
            <div class="between"><span>Разряд ${user.rank + 1}</span><strong class="num">${user.xpToNextRank ?? 0} XP</strong></div>
            ${progressBar(user.rankProgressPercent, "Прогресс до следующего разряда")}
            <p class="small" style="margin-top:12px">${user.totalXp} XP · следующий порог ${user.nextRankXp} XP</p>
          `
        }) : ""}

        <div class="mascot-column"></div>
      </div>
    </div>
  `);

  const column = root.querySelector(".mascot-column");
  column.replaceChildren(mascot);
  root.dispose = () => mascot.dispose?.();
  return root;
}
