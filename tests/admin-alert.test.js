import { test } from "node:test";
import assert from "node:assert/strict";
import { addAdminDevice, removeAdminDevice, notifyAdmin, shouldAlertAdmin, ADMIN_ALERT_TEXT } from "../lib/admin-alert.js";

const memory = () => {
  const m = new Map();
  return { getSetting: async (k) => m.get(k), setSetting: async (k, v) => void m.set(k, v) };
};
const dev = (n) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, keys: { p256dh: "p", auth: "a" } });

test("only a reporter's story sent for approval alerts the admin", () => {
  assert.equal(shouldAlertAdmin("reporter", true), true);
  assert.equal(shouldAlertAdmin("reporter", false), false); // a draft is not sent for approval
  assert.equal(shouldAlertAdmin("editor", true), false);
  assert.equal(shouldAlertAdmin("sub_editor", true), false);
  assert.equal(shouldAlertAdmin("admin", true), false);
});

test("the alert is the same plain message and carries no name or headline", async () => {
  const store = memory();
  await addAdminDevice(dev(1), { store });
  const payloads = [];
  const sent = await notifyAdmin({ store, send: async (_sub, payload) => void payloads.push(JSON.parse(payload)) });
  assert.equal(sent, 1);
  assert.equal(payloads[0].body, ADMIN_ALERT_TEXT);
  assert.equal(payloads[0].url, "/admin?view=pending");
  assert.deepEqual(Object.keys(payloads[0]).sort(), ["body", "tag", "title", "url"]);
});

test("devices that are gone are removed, a failing device never stops the others, and nothing throws", async () => {
  const store = memory();
  await addAdminDevice(dev(1), { store });
  await addAdminDevice(dev(2), { store });
  const sent = await notifyAdmin({
    store,
    send: async (sub) => {
      if (sub.endpoint.endsWith("/1")) throw Object.assign(new Error("gone"), { statusCode: 410 });
    },
  });
  assert.equal(sent, 1);
  assert.deepEqual((await store.getSetting("admin_push")).map((s) => s.endpoint), [dev(2).endpoint]);
  await removeAdminDevice(dev(2).endpoint, { store });
  assert.equal(await notifyAdmin({ store, send: async () => {} }), 0);
  const broken = { getSetting: async () => { throw new Error("db"); }, setSetting: async () => { throw new Error("db"); } };
  assert.equal(await notifyAdmin({ store: broken, send: async () => {} }), 0);
});

test("only a browser maker's push address is accepted, and at most five devices are kept", async () => {
  const store = memory();
  await addAdminDevice({ endpoint: "https://evil.example.com/x", keys: { p256dh: "p", auth: "a" } }, { store });
  assert.equal(await notifyAdmin({ store, send: async () => { throw new Error("must not send"); } }), 0);
  for (let i = 0; i < 7; i++) await addAdminDevice(dev(i), { store });
  assert.equal((await store.getSetting("admin_push")).length <= 5, true);
});
