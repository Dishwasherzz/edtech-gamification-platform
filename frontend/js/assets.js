// Логические ключи ресурсов из API и файлы в папке frontend/assets.
// assetKey — это идентификатор ресурса, а не готовый URL: сопоставление живёт здесь.
const ASSETS = {
  "heroes/phase": "/assets/heroes/phase.png",
  "heroes/ampere": "/assets/heroes/ampere.png",
  "heroes/phase-face": "/assets/heroes/phase-face.png",
  "heroes/ampere-face": "/assets/heroes/ampere-face.png",
  "mascots/spark": "/assets/mascots/spark.png",
  "mascots/ohm": "/assets/mascots/ohm.png",
  "mascots/relay": "/assets/mascots/relay.png"
};

// Портрет героя: в макете спутник — это сам персонаж, поэтому подсказки
// должны соответствовать выбранному герою, а не маскоту по умолчанию.
const HERO_FACES = {
  "heroes/phase": "heroes/phase-face",
  "heroes/ampere": "heroes/ampere-face"
};

// Ключ героя → персонаж: у «Фаза» мужской, у «Ампера» женский.
const HERO_CHARACTER = { phase: "male", ampere: "female" };

// Кадры персонажа по состоянию и полные ракурсы. Имена совпадают
// с файлами в frontend/assets/characters.
const CHARACTER_ASSETS = {
  male: {
    calm: "/assets/characters/male_calm.png",
    focus: "/assets/characters/male_focus.png",
    joy: "/assets/characters/male_joy.png",
    surprise: "/assets/characters/male_surprise.png",
    support: "/assets/characters/male_support.png",
    front: "/assets/characters/male_full_front.png",
    side: "/assets/characters/male_full_side.png",
    back: "/assets/characters/male_full_back.png"
  },
  female: {
    calm: "/assets/characters/female_calm.png",
    focus: "/assets/characters/female_focus.png",
    joy: "/assets/characters/female_joy.png",
    surprise: "/assets/characters/female_surprise.png",
    support: "/assets/characters/female_support.png",
    front: "/assets/characters/female_full_front.png",
    side: "/assets/characters/female_full_side.png",
    back: "/assets/characters/female_full_back.png"
  }
};

// Состояния и ракурсы, для которых есть файлы.
export const MOODS = ["calm", "focus", "joy", "surprise", "support"];
export const VIEWS = ["front", "side", "back"];

// Маска → состояние персонажа: у каждой маски своя эмоция, поэтому лица
// в карточках различаются. Пол берётся у выбранного героя: у девочки
// показываются женские кадры, у парня — мужские.
// Искра поддерживает (радость), Ом помогает спокойно (спокойствие),
// Реле внимательно следит за цепью (удивление).
const MASCOT_MOOD = { spark: "joy", ohm: "calm", relay: "surprise" };

// Кадр маски: набор персонажа 512×512 вместо отдельных файлов меньшего разрешения.
export function mascotImage(mascot, character) {
  const key = String(mascot?.key ?? "").toLowerCase();
  const mood = MASCOT_MOOD[key];
  return mood ? moodAsset(character, mood) : null;
}

export function assetUrl(key) {
  if (!key) return null;
  const direct = ASSETS[String(key)];
  if (direct) return direct;
  // «mascots/spark/idle» → «mascots/spark», если есть такой файл.
  const parts = String(key).split("/");
  for (let length = parts.length; length > 1; length--) {
    const candidate = ASSETS[parts.slice(0, length).join("/")];
    if (candidate) return candidate;
  }
  return null;
}

// Первый ключ, для которого есть файл.
export function firstAsset(keys) {
  for (const key of [].concat(keys ?? [])) {
    const url = assetUrl(key);
    if (url) return url;
  }
  return null;
}

// Порядок ресурсов для портрета спутника и аватара в шапке.
export function companionAssets(user) {
  if (!user) return [];
  return [
    HERO_FACES[user.hero?.assetKey],
    user.hero?.assetKey,
    user.mascot?.assetKey,
    user.characterSkin?.assetKey
  ].filter(Boolean);
}

// Изображение скина: только если для ключа есть реальный файл.
// Пока файлов скинов нет, функция возвращает null — вызывающий код
// показывает запасной портрет персонажа.
export function skinAsset(skin) {
  if (!skin) return null;
  return ASSETS[String(skin.assetKey ?? "")] ?? null;
}

// Портрет выбранного маскота. Для женского героя набора мимики нет:
// показываем исходный портрет, как в макете.
export function mascotAsset(user, mascot) {
  const face = HERO_FACES[user?.hero?.assetKey];
  if (face) return face;
  return mascot?.assetKey ?? null;
}

// Пол персонажа по ключу ресурса: «heroes/ampere» — женский, «heroes/phase» — мужской.
export function characterByAssetKey(assetKey) {
  const key = String(assetKey ?? "").toLowerCase();
  if (!key) return null;
  if (key.includes("ampere") || key.includes("female")) return "female";
  if (key.includes("phase") || key.includes("male")) return "male";
  return null;
}

// Пол персонажа по ключу героя. Если ключ неизвестен, смотрим на assetKey.
export function heroCharacter(hero) {
  if (!hero) return "male";
  if (HERO_CHARACTER[hero.key]) return HERO_CHARACTER[hero.key];
  return characterByAssetKey(hero.assetKey) ?? "male";
}

// Персонаж, который сопровождает пользователя: выбранный герой.
export function companionCharacter(user) {
  return heroCharacter(user?.hero);
}

// Кадр персонажа по состоянию: спокойствие, фокус, радость, удивление, поддержка.
export function moodAsset(character, mood) {
  const set = CHARACTER_ASSETS[character] ?? CHARACTER_ASSETS.male;
  return set[MOODS.includes(mood) ? mood : "calm"];
}

// Полный рост: вид спереди, сбоку или сзади.
export function fullAsset(character, view) {
  const set = CHARACTER_ASSETS[character] ?? CHARACTER_ASSETS.male;
  return set[VIEWS.includes(view) ? view : "front"];
}
