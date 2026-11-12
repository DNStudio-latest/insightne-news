import { test } from "node:test";
import assert from "node:assert/strict";
import { langPath, splitLangPath, INDEXED_LANGUAGES } from "../lib/languages.js";
import { alternatesFor, noindexUnlessTranslated } from "../lib/seo.js";
import { readFileSync } from "node:fs";
import { routeForLanguage } from "../lib/lang-routing.js";

test("langPath: English keeps the plain address, others get a prefix", () => {
  assert.equal(langPath("en", "/story/x"), "/story/x");
  assert.equal(langPath("bn", "/story/x"), "/bn/story/x");
  assert.equal(langPath("bn", "/"), "/bn");
  assert.equal(langPath("zz", "/story/x"), "/story/x");
  assert.equal(langPath("hi", "today"), "/hi/today");
});

test("splitLangPath reads the language off the address", () => {
  assert.deepEqual(splitLangPath("/bn/story/x"), { lang: "bn", path: "/story/x" });
  assert.deepEqual(splitLangPath("/bn"), { lang: "bn", path: "/" });
  assert.deepEqual(splitLangPath("/story/x"), { lang: "en", path: "/story/x" });
  assert.deepEqual(splitLangPath("/tips"), { lang: "en", path: "/tips" }); // a page name is not a language
  assert.deepEqual(splitLangPath("/trpb/story/x"), { lang: "trpb", path: "/story/x" }); // Kokborok in Bengali letters
  assert.equal(langPath("trpb", "/story/x"), "/trpb/story/x");
});

test("only English and Bengali are offered to search engines for now", () => {
  assert.deepEqual(INDEXED_LANGUAGES, ["en", "bn"]);
});

test("alternatesFor: own address plus hreflang for translated pages", () => {
  assert.deepEqual(alternatesFor("bn", "/story/x"), { canonical: "/bn/story/x", languages: { en: "/story/x", bn: "/bn/story/x", "x-default": "/story/x" } });
  assert.deepEqual(alternatesFor("bn", "/story/x", { translated: false }), { canonical: "/story/x" });
  assert.equal(alternatesFor("hi", "/").canonical, "/hi");
  assert.equal(alternatesFor("hi", "/").languages, undefined);
  assert.deepEqual(noindexUnlessTranslated("bn", false), { robots: { index: false, follow: true } });
  assert.deepEqual(noindexUnlessTranslated("en", false), {});
});

test("routing: plain address is served from the English pages; /en/ redirects to the plain address", () => {
  assert.deepEqual(routeForLanguage({ pathname: "/story/x" }), { action: "rewrite", path: "/en/story/x" });
  assert.deepEqual(routeForLanguage({ pathname: "/" }), { action: "rewrite", path: "/en" });
  assert.deepEqual(routeForLanguage({ pathname: "/en/story/x" }), { action: "redirect", status: 308, path: "/story/x" });
  assert.deepEqual(routeForLanguage({ pathname: "/en" }), { action: "redirect", status: 308, path: "/" });
});

test("routing: Bengali addresses pass through; a saved Bengali choice redirects plain addresses", () => {
  assert.deepEqual(routeForLanguage({ pathname: "/bn/story/x" }), { action: "next" });
  assert.deepEqual(routeForLanguage({ pathname: "/story/x", savedLang: "bn" }), { action: "redirect", status: 307, path: "/bn/story/x" });
  assert.deepEqual(routeForLanguage({ pathname: "/", savedLang: "bn" }), { action: "redirect", status: 307, path: "/bn" });
  assert.equal(routeForLanguage({ pathname: "/story/x", savedLang: "en" }).action, "rewrite");
  assert.equal(routeForLanguage({ pathname: "/story/x", savedLang: "zz" }).action, "rewrite");
  assert.equal(routeForLanguage({ pathname: "/story/x", savedLang: "bn", method: "POST" }).action, "rewrite");
});

test("proxy matcher leaves admin, API, files and service addresses alone", () => {
  const src = readFileSync(new URL("../proxy.js", import.meta.url), "utf8");
  // The matcher as written in proxy.js (a JavaScript string, so JSON.parse reads its backslashes the same way).
  const pattern = JSON.parse(/matcher: \[("[^\n]*")\],/.exec(src)[1]);
  const re = new RegExp(`^${pattern}$`);
  for (const p of ["/", "/story/x", "/bn/story/x", "/category/tripura", "/about", "/tips"]) assert.ok(re.test(p), p);
  for (const p of ["/admin", "/admin/write", "/api/view", "/_next/static/a.js", "/feed.xml", "/sitemap.xml", "/lang/bn", "/s/abc", "/card/x", "/ai-tools", "/icon", "/manifest.webmanifest", "/sw.js"]) assert.ok(!re.test(p), p);
});
