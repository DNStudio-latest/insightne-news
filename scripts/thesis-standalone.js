// Builds one self-contained HTML file of the thesis checker (page, engine, academic module and model inlined),
// for use on a PC without the internet. Nothing in it sends text anywhere, and it uses no AI to change text.
//
//   node scripts/thesis-standalone.js [thesis-checker.html]
//
// Each module is wrapped in its own function scope, so private names in different files do not clash.

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const dir = new URL("../public/ai-tools/", import.meta.url);
const ORDER = ["engine.js", "academic-words.js", "academic-norms.js", "academic.js", "model-academic.js"];
const IMPORT_RE = /^import \{([^}]+)\} from "\.\/([\w.-]+)";\s*$/gm;

const varName = (file) => `__${file.replace(/\.js$/, "").replace(/\W/g, "_")}`;

// The names a module exports (export const/function/let/class and export { a, b }).
export function exportedNames(source) {
  const names = [...source.matchAll(/^export (?:async )?(?:const|let|function\*?|class) ([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
  for (const m of source.matchAll(/^export \{([^}]+)\};?\s*$/gm)) names.push(...m[1].split(",").map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean));
  return [...new Set(names)];
}

const bindings = (list) => list.split(",").map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/\s+as\s+/, ": ")).join(", ");

// Turns one ES module into `const __name = (() => { …; return { exports }; })();`.
export function wrapModule(file, source) {
  const names = exportedNames(source);
  const body = source
    .replace(IMPORT_RE, (_, list, from) => `const { ${bindings(list)} } = ${varName(from)};`)
    .replace(/^export \{[^}]+\};?\s*$/gm, "")
    .replace(/^export (?=(?:async )?(?:const|let|function|class))/gm, "");
  return `// ---- ${file} ----\nconst ${varName(file)} = (() => {\n${body}\nreturn { ${names.join(", ")} };\n})();\n`;
}

export function build() {
  const page = readFileSync(new URL("./thesis-checker.template.html", import.meta.url), "utf8");
  const modules = ORDER.map((f) => wrapModule(f, readFileSync(new URL(f, dir), "utf8"))).join("\n");
  const scriptStart = page.indexOf('<script type="module">') + '<script type="module">'.length;
  let script = page.slice(scriptStart, page.indexOf("</script>", scriptStart));
  if (!IMPORT_RE.test(script)) throw new Error("The template no longer imports the modules as expected");
  script = script.replace(IMPORT_RE, (_, list, from) => `const { ${bindings(list)} } = ${varName(from)};`);
  return page.slice(0, scriptStart) + "\n" + modules + script + page.slice(page.indexOf("</script>", scriptStart));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = process.argv[2] || "thesis-checker.html";
  writeFileSync(out, build());
  console.log(`Saved ${out}`);
}
