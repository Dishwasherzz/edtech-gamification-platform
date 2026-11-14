// Логические ключи ресурсов из API и файлы в папке frontend/assets.
// assetKey — это идентификатор ресурса, а не готовый URL: сопоставление живёт здесь.
const ASSETS = {
  "heroes/phase": "assets/heroes/phase.png",
  "heroes/ampere": "assets/heroes/ampere.png",
  "mascots/spark": "assets/mascots/spark.png",
  "mascots/ohm": "assets/mascots/ohm.png",
  "mascots/relay": "assets/mascots/relay.png"
};

export function assetUrl(key) {
  if (!key) return null;
  if (Array.isArray(key)) {
    for (const candidate of key) {
      const url = assetUrl(candidate);
      if (url) return url;
    }
    return null;
  }
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
