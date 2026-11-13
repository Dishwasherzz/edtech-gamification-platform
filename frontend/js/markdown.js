// Рендер учебного Markdown и формул TeX без внешних библиотек.
// Лекции приходят с сервера как Markdown с формулами `$…$` и `$$…$$`.

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

/* ----------------------------- Формулы TeX ----------------------------- */

const TEX_SYMBOLS = {
  cdot: "·", times: "×", div: "÷", pm: "±", mp: "∓", ast: "∗", star: "⋆",
  le: "≤", leq: "≤", ge: "≥", geq: "≥", ne: "≠", neq: "≠", approx: "≈", sim: "∼",
  equiv: "≡", propto: "∝", ll: "≪", gg: "≫",
  ldots: "…", dots: "…", cdots: "⋯", vdots: "⋮",
  sum: "∑", prod: "∏", int: "∫", iint: "∬", oint: "∮", partial: "∂", nabla: "∇",
  infty: "∞", to: "→", rightarrow: "→", Rightarrow: "⇒", leftarrow: "←", Leftarrow: "⇐",
  leftrightarrow: "↔", Leftrightarrow: "⇔", implies: "⟹", iff: "⟺", mapsto: "↦",
  in: "∈", notin: "∉", subset: "⊂", subseteq: "⊆", supset: "⊃", cup: "∪", cap: "∩",
  setminus: "∖", emptyset: "∅", varnothing: "∅",
  lbrace: "{", rbrace: "}", lbrack: "[", rbrack: "]", langle: "⟨", rangle: "⟩", lvert: "|", rvert: "|",
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", Delta: "Δ", epsilon: "ε", varepsilon: "ε",
  zeta: "ζ", eta: "η", theta: "θ", vartheta: "ϑ", lambda: "λ", mu: "μ", nu: "ν",
  xi: "ξ", pi: "π", varpi: "ϖ", rho: "ρ", varrho: "ϱ", sigma: "σ", varsigma: "ς",
  tau: "τ", upsilon: "υ", phi: "φ", varphi: "ϕ", chi: "χ", psi: "ψ", Psi: "Ψ",
  omega: "ω", Omega: "Ω", Gamma: "Γ", Lambda: "Λ", Theta: "Θ", Xi: "Ξ", Pi: "Π",
  sin: "sin", cos: "cos", tan: "tan", cot: "cot", sec: "sec", csc: "csc",
  log: "log", ln: "ln", lg: "lg", exp: "exp", lim: "lim", arcsin: "arcsin", arccos: "arccos",
  arctan: "arctan", min: "min", max: "max", arg: "arg", deg: "deg", dim: "dim",
  ker: "ker", mod: "mod", sgn: "sgn",
  prime: "′", percent: "%", dollar: "$", hash: "#", and: "∧", or: "∨", neg: "¬",
  lceil: "⌈", rceil: "⌉", lfloor: "⌊", rfloor: "⌋"
};

const TEX_TEXT_COMMANDS = new Set(["text", "textrm", "mathrm", "mathbf", "mathit", "operatorname", "mbox", "textbf"]);

// Имена функций в TeX набираются прямым шрифтом, остальные буквы — курсивом.
const TEX_FUNCTIONS = new Set(["sin", "cos", "tan", "cot", "sec", "csc", "log", "ln", "lg", "exp", "lim", "arcsin", "arccos", "arctan", "min", "max", "arg", "deg", "dim", "ker", "mod", "sgn"]);

// Читает содержимое группы: `{…}` с учётом вложенности либо один символ.
function readGroup(source, index) {
  if (source[index] === "{") {
    let depth = 0;
    let j = index;
    for (; j < source.length; j++) {
      const char = source[j];
      if (char === "\\") { j++; continue; }
      if (char === "{") depth++;
      else if (char === "}") { depth--; if (depth === 0) break; }
    }
    return { content: source.slice(index + 1, j), next: j + 1 };
  }
  return { content: source[index] ?? "", next: index + 1 };
}

// Основной разбор TeX в подмножество HTML со span-ами.
export function tex(source) {
  let out = "";
  let i = 0;
  const text = String(source ?? "");

  while (i < text.length) {
    const char = text[i];

    if (char === "\\") {
      const match = /^\\([A-Za-z]+|.)/.exec(text.slice(i));
      if (!match) { i++; continue; }
      const name = match[1];
      i += match[0].length;

      if (name === "frac") {
        const numerator = readGroup(text, i); i = numerator.next;
        const denominator = readGroup(text, i); i = denominator.next;
        out += `<span class="frac"><span class="num">${tex(numerator.content)}</span><span class="den">${tex(denominator.content)}</span></span>`;
        continue;
      }
      if (name === "dfrac" || name === "tfrac") {
        const numerator = readGroup(text, i); i = numerator.next;
        const denominator = readGroup(text, i); i = denominator.next;
        out += `<span class="frac ${name}"><span class="num">${tex(numerator.content)}</span><span class="den">${tex(denominator.content)}</span></span>`;
        continue;
      }
      if (TEX_TEXT_COMMANDS.has(name)) {
        const group = readGroup(text, i); i = group.next;
        out += `<span class="mtext">${escapeHtml(group.content)}</span>`;
        continue;
      }
      if (name === "sqrt") {
        const group = readGroup(text, i); i = group.next;
        out += `<span class="sqrt"><span class="radic">${tex(group.content)}</span></span>`;
        continue;
      }
      if (name === "quad" || name === "qquad" || name === "," || name === ";" || name === ":") {
        out += `<span class="mspace${name === "qquad" ? " wider" : name === "quad" ? " wide" : ""}"></span>`;
        continue;
      }
      if (name === "left" || name === "right") {
        const group = readGroup(text, i); i = group.next;
        out += escapeHtml(group.content);
        continue;
      }
      if (TEX_SYMBOLS[name] !== undefined) {
        const symbol = TEX_SYMBOLS[name];
        out += /^[A-Za-z]+$/.test(symbol) ? `<span class="upright">${symbol}</span>` : `<span class="sym">${symbol}</span>`;
        continue;
      }
      // Неизвестная команда: показываем её имя, чтобы формула не исчезла.
      out += `<span class="upright">${escapeHtml(name)}</span>`;
      continue;
    }

    if (char === "^" || char === "_") {
      const group = readGroup(text, i + 1);
      i = group.next;
      const tag = char === "^" ? "sup" : "sub";
      out += `<${tag}>${tex(group.content)}</${tag}>`;
      continue;
    }

    if (char === "{") {
      const group = readGroup(text, i); i = group.next;
      out += tex(group.content);
      continue;
    }

    if (char === "}") { i++; continue; }

    if (/\s/.test(char)) { out += " "; i++; continue; }

    if (/[0-9.]/.test(char)) { out += char; i++; continue; }

    if (/[A-Za-zА-Яа-яЁё]/.test(char)) {
      let j = i;
      while (j < text.length && /[A-Za-zА-Яа-яЁё]/.test(text[j])) j++;
      const word = text.slice(i, j);
      i = j;
      if (TEX_FUNCTIONS.has(word)) out += `<span class="upright">${word}</span>`;
      else out += [...word].map(letter => `<i>${letter}</i>`).join("");
      continue;
    }

    out += escapeHtml(char);
    i++;
  }

  return out;
}

/* ------------------------------ Markdown ------------------------------- */

const LIST_MARK = /^\s*([-*+]|\d+[.)])\s+/;
const HEADING_MARK = /^(#{1,6})\s+(.*)$/;
const QUOTE_MARK = /^\s*>\s?/;
const RULE_MARK = /^\s*([-*_])\s*(\1\s*){2,}$/;

function splitBlocks(source) {
  const lines = String(source ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const heading = HEADING_MARK.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }

    if (RULE_MARK.test(line)) { blocks.push({ type: "rule" }); i++; continue; }

    if (QUOTE_MARK.test(line)) {
      const buffer = [];
      while (i < lines.length && QUOTE_MARK.test(lines[i])) {
        buffer.push(lines[i].replace(QUOTE_MARK, ""));
        i++;
      }
      blocks.push({ type: "quote", text: buffer.join("\n") });
      continue;
    }

    if (LIST_MARK.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items = [];
      while (i < lines.length && LIST_MARK.test(lines[i])) {
        items.push(lines[i].replace(LIST_MARK, ""));
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const buffer = [];
    while (i < lines.length && lines[i].trim() && !HEADING_MARK.test(lines[i]) &&
      !LIST_MARK.test(lines[i]) && !QUOTE_MARK.test(lines[i]) && !RULE_MARK.test(lines[i])) {
      buffer.push(lines[i]);
      i++;
    }
    if (buffer.length) blocks.push({ type: "paragraph", text: buffer.join("\n") });
    else i++;
  }

  return blocks;
}

// Инлайновое оформление: формулы вынимаются до экранирования HTML.
function inline(text) {
  const store = [];
  const hold = html => `\u0000${store.push(html) - 1}\u0000`;

  let source = String(text ?? "");
  source = source.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => hold(`<span class="math math-block">${tex(math)}</span>`));
  source = source.replace(/\$([^$\n]+?)\$/g, (_, math) => hold(`<span class="math math-inline">${tex(math)}</span>`));
  source = source.replace(/`([^`]+)`/g, "<code>$1</code>");
  source = escapeHtml(source);
  source = source.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  source = source.replace(/(?<![\w*])\*(?!\s)([^*]+?)(?<!\s)\*(?![\w*])/g, "<em>$1</em>");
  source = source.replace(/\u0000(\d+)\u0000/g, (_, index) => store[Number(index)]);
  return source;
}

// Отдельный блок формулы, когда вся строка — это `$$…$$`.
function isDisplayMath(text) {
  const trimmed = text.trim();
  return trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length > 4;
}

export function markdown(source) {
  return splitBlocks(source).map(block => {
    if (block.type === "rule") return "<hr>";
    if (block.type === "heading") {
      const level = Math.min(6, block.level + 1);
      return `<h${level}>${inline(block.text)}</h${level}>`;
    }
    if (block.type === "quote") return `<blockquote>${inline(block.text)}</blockquote>`;
    if (block.type === "list") {
      const tag = block.ordered ? "ol" : "ul";
      return `<${tag}>${block.items.map(item => `<li>${inline(item)}</li>`).join("")}</${tag}>`;
    }
    if (isDisplayMath(block.text)) {
      const math = block.text.trim().slice(2, -2);
      return `<div class="math math-display">${tex(math)}</div>`;
    }
    return `<p>${inline(block.text).replace(/\r?\n/g, "<br>")}</p>`;
  }).join("");
}
