import { test } from "node:test";
import assert from "node:assert/strict";
import tls from "node:tls";
import { createRelayFetch } from "../lib/hunter/relay.js";
import { trustNewLetsEncryptRoots } from "../lib/hunter/extra-roots.js";

test("when the Mumbai server cannot read a page, the Hunter reads it directly", async () => {
  const fetchFn = async (url) =>
    url.startsWith("https://site.test")
      ? new Response("", { headers: { "x-relay-error": "fetch failed in Mumbai: UNABLE_TO_GET_ISSUER_CERT_LOCALLY" } })
      : new Response("the page");
  const relayFetch = createRelayFetch({ relayUrl: "https://site.test/api/hunter-fetch", secret: "s", fetchFn });
  assert.equal(await (await relayFetch("https://megipr.gov.in")).text(), "the page");
});

test("if both fail, both reasons are reported", async () => {
  const fetchFn = async (url) => {
    if (url.startsWith("https://site.test")) return new Response("", { headers: { "x-relay-error": "fetch failed in Mumbai: timeout" } });
    throw Object.assign(new Error("fetch failed"), { cause: { code: "ECONNRESET" } });
  };
  const relayFetch = createRelayFetch({ relayUrl: "https://site.test/api/hunter-fetch", secret: "s", fetchFn });
  await assert.rejects(relayFetch("https://ceo.nagaland.gov.in/"), /Mumbai: timeout; directly: ECONNRESET/);
});

test("Let's Encrypt's newer roots are trusted", () => {
  if (typeof tls.setDefaultCACertificates !== "function") return; // older Node: nothing to add
  assert.equal(trustNewLetsEncryptRoots(), true);
  assert.ok(tls.getCACertificates("default").length >= tls.rootCertificates.length + 2);
});
