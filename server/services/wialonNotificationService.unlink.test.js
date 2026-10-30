/**
 * Unit tests for Cierre de servicio → Intacsep GPS unlink planning.
 * Run: node --test server/services/wialonNotificationService.unlink.test.js
 *
 * Does not call Wialon or Mongo.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isStatusCerrada,
  isCierreDeServicioNombre,
  allTransportesHaveCierre,
  collectBitacoraNotifBindings,
  planUnlinkBindings,
  unitNotifKey,
} from "./wialonNotificationService.js";

describe("isStatusCerrada / isCierreDeServicioNombre", () => {
  it("matches canonical cerrada only", () => {
    assert.equal(isStatusCerrada("cerrada"), true);
    assert.equal(isStatusCerrada("Cerrada"), true);
    assert.equal(isStatusCerrada("finalizada"), false);
    assert.equal(isStatusCerrada("iniciada"), false);
    assert.equal(isStatusCerrada("cerrada (e)"), false);
  });

  it("detects Cierre de servicio regardless of case", () => {
    assert.equal(isCierreDeServicioNombre("Cierre de servicio"), true);
    assert.equal(isCierreDeServicioNombre("CIERRE DE SERVICIO"), true);
    assert.equal(isCierreDeServicioNombre("Inicio de recorrido"), false);
  });
});

describe("allTransportesHaveCierre", () => {
  it("requires every transporte to appear on a Cierre event", () => {
    const bitacora = {
      transportes: [
        { id: "T1", internalId: "a" },
        { id: "T2", internalId: "b" },
      ],
      eventos: [
        {
          nombre: "Cierre de servicio",
          transportes: [{ id: "T1", internalId: "a" }],
        },
      ],
    };
    assert.equal(allTransportesHaveCierre(bitacora), false);
    bitacora.eventos.push({
      nombre: "Cierre de servicio",
      transportes: [{ id: "T2", internalId: "b" }],
    });
    assert.equal(allTransportesHaveCierre(bitacora), true);
  });

  it("matches by id when internalId differs on the event copy", () => {
    const bitacora = {
      transportes: [{ id: "T1", internalId: "real" }],
      eventos: [
        {
          nombre: "Cierre de servicio",
          transportes: [{ id: "T1", internalId: "mongoose-generated" }],
        },
      ],
    };
    assert.equal(allTransportesHaveCierre(bitacora), true);
  });
});

describe("collectBitacoraNotifBindings", () => {
  it("crosses every GPS with every notification on each transporte", () => {
    const bitacora = {
      transportes: [
        {
          gpsUnits: [
            { wialonId: "111", name: "G43 - Libre" },
            { wialonId: "222", name: "CUSTODIA" },
          ],
          notificaciones: [
            { resourceId: 10, notifId: 1 },
            { resourceId: "10", notifId: "2" },
          ],
        },
      ],
    };
    const bindings = collectBitacoraNotifBindings(bitacora);
    assert.equal(bindings.length, 4);
    assert.deepEqual(
      bindings.map((b) => unitNotifKey(b.unitId, b.resourceId, b.notifId)).sort(),
      ["111_10_1", "111_10_2", "222_10_1", "222_10_2"].sort()
    );
  });
});

describe("planUnlinkBindings (business rule)", () => {
  const bindings = [
    { unitId: "111", resourceId: 10, notifId: 1 },
    { unitId: "111", resourceId: 10, notifId: 2 },
    { unitId: "222", resourceId: 10, notifId: 1 },
    { unitId: "222", resourceId: 10, notifId: 2 },
  ];

  it("unlinks both GPS when neither is kept by another non-cerrada bitácora", () => {
    const plan = planUnlinkBindings(bindings, new Set(), true);
    assert.equal(plan.toUnlink.length, 4);
    assert.equal(plan.skippedShared.length, 0);
    assert.equal(plan.error, undefined);
  });

  it("keeps the shared GPS and unlinks the exclusive one", () => {
    const plan = planUnlinkBindings(bindings, new Set(["111"]), true);
    assert.deepEqual(
      plan.toUnlink.map((b) => b.unitId),
      ["222", "222"]
    );
    assert.deepEqual(
      plan.skippedShared.map((b) => b.unitId),
      ["111", "111"]
    );
  });

  it("unlinks GPS that only appears on other cerrada bitácoras (not in kept set)", () => {
    const plan = planUnlinkBindings(bindings, new Set(), true);
    assert.equal(plan.toUnlink.length, 4);
  });

  it("keeps GPS related to another bitácora with status != cerrada (kept set)", () => {
    const plan = planUnlinkBindings(bindings, new Set(["222"]), true);
    assert.ok(plan.skippedShared.every((b) => b.unitId === "222"));
    assert.ok(plan.toUnlink.every((b) => b.unitId === "111"));
  });

  it("does not let the current bitácora block itself (empty kept set unlinks all)", () => {
    const plan = planUnlinkBindings(bindings, new Set(), true);
    assert.equal(plan.toUnlink.length, bindings.length);
  });

  it("is idempotent: planning twice with same inputs yields the same split", () => {
    const kept = new Set(["111"]);
    const a = planUnlinkBindings(bindings, kept, true);
    const b = planUnlinkBindings(bindings, kept, true);
    assert.deepEqual(a, b);
  });

  it("fail-closed when lookup fails (no Wialon writes)", () => {
    const plan = planUnlinkBindings(bindings, new Set(), false);
    assert.equal(plan.toUnlink.length, 0);
    assert.equal(plan.skippedShared.length, 4);
    assert.equal(plan.error, "open_bindings_lookup_failed");
  });

  it("preserves unrelated units conceptually: only listed bindings are touched", () => {
    const onlyOne = bindings.filter((b) => b.unitId === "222" && b.notifId === 1);
    const plan = planUnlinkBindings(onlyOne, new Set(), true);
    assert.equal(plan.toUnlink.length, 1);
    assert.equal(plan.toUnlink[0].unitId, "222");
    assert.equal(plan.toUnlink[0].notifId, 1);
  });
});
