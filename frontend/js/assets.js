// Логические ключи ресурсов из API и файлы в папке frontend/assets.
// assetKey — это идентификатор ресурса, а не готовый URL: сопоставление живёт здесь.
const ASSETS = {
  "heroes/phase": "assets/heroes/phase.png",
  "heroes/ampere": "assets/heroes/ampere.png",
  "heroes/phase-face": "assets/heroes/phase-face.png",
  "heroes/ampere-face": "assets/heroes/ampere-face.png",
  "mascots/spark": "assets/mascots/spark.png",
  "mascots/ohm": "assets/mascots/ohm.png",
  "mascots/relay": "assets/mascots/relay.png"
};

// Портрет героя: в макете спутник — это сам персонаж, поэтому подсказки
// должны соответствовать выбранному герою, а не маскоту по умолчанию.
const HERO_FACES = {
  "heroes/phase": "heroes/phase-face",
  "heroes/ampere": "heroes/ampere-face"
};

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

// Портрет выбранного маскота. Для женского героя набора мимики нет:
// показываем исходный портрет, как в макете.
export function mascotAsset(user, mascot) {
  const face = HERO_FACES[user?.hero?.assetKey];
  if (face) return face;
  return mascot?.assetKey ?? null;
}
