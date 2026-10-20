import crypto from "crypto";
import Integration from "../models/Integration.js";
import VehicleMapping from "../models/VehicleMapping.js";
import InboundMessage from "../models/InboundMessage.js";

const BATCH_LIMIT = parseInt(process.env.WIALON_FLUSH_BATCH_LIMIT || "500", 10);
const MAX_ATTEMPTS = parseInt(process.env.WIALON_FLUSH_MAX_ATTEMPTS || "5", 10);

/**
 * Service to handle Wialon Remote API integrations.
 */
class WialonIntegrationService {
  constructor() {
    this.baseUrl = "https://hst-api.wialon.com/wialon/ajax.html";
  }

  /**
   * Helper to call Wialon Remote API
   */
  async _call(svc, params, sid = null) {
    const url = new URL(this.baseUrl);
    url.searchParams.append("svc", svc);
    if (sid) {
      url.searchParams.append("sid", sid);
    }

    const formData = new URLSearchParams();
    formData.append("params", JSON.stringify(params));

    const response = await fetch(url.toString(), { 
      method: "POST",
      body: formData
    });
    const data = await response.json();

    if (data.error) {
      throw new Error(`Wialon API Error ${data.error}: ${this._getErrorText(data.error)}`);
    }
    return data;
  }

  _getErrorText(code) {
    const errors = {
      1: "Invalid session",
      2: "Invalid service name",
      3: "Invalid result",
      4: "Invalid input",
      5: "Error performing request",
      6: "Unknown error",
      7: "Access denied",
      8: "Invalid user name or password",
      9: "Authorization error, retry later",
      10: "Language not found",
      1001: "No messages for selected period",
      1002: "Item with such unique ID already exists",
      1003: "Only one axis is allowed",
      1004: "Limit for this type of units exceeded",
    };
    return errors[code] || "Unknown error";
  }

  /**
   * Login to Wialon and return session ID
   */
  async login(token) {
    const data = await this._call("token/login", { token });
    return data.eid; // Session ID
  }

  /**
   * Ensure a Wialon unit exists for the mapping.
   * Creates unit if missing, or updates properties if found.
   */
  async ensureUnitExists(mapping, integration, sid) {
    console.log(`Ensuring Wialon unit exists for Economico: ${mapping.economico}`);
    
    // 1. Try to find unit by Economico (name)
    const searchParams = {
      spec: {
        itemsType: "avl_unit",
        propName: "sys_name",
        propValueMask: mapping.economico,
        sortType: "sys_name",
      },
      force: 1,
      flags: 1,
      from: 0,
      to: 0,
    };
    const searchData = await this._call("core/search_items", searchParams, sid);
    let unit = searchData.items && searchData.items.length > 0 ? searchData.items[0] : null;

    const creatorId = integration.wialonCreatorId || process.env.WIALON_DEFAULT_CREATOR_ID;
    const hwTypeId = integration.wialonHwTypeId || process.env.WIALON_DEFAULT_HW_TYPE_ID;

    if (!unit) {
      // 2. Create if not exists

      if (!creatorId || !hwTypeId) {
        throw new Error("Wialon Creator ID or Hardware Type ID missing for unit creation.");
      }

      const createParams = {
        creatorId: parseInt(creatorId, 10),
        name: mapping.economico,
        hwTypeId: parseInt(hwTypeId, 10),
        dataFlags: 1,
      };
      const createData = await this._call("core/create_unit", createParams, sid);
      unit = createData.item;
      console.log(`Created new Wialon unit: ${unit.id}`);
    }

    // 3. Set unique ID (gps<IMEI>) and keep device type aligned with Flespi Gateway (or whatever
    // hwTypeId is configured on the integration / env). Using 0 here overwrote the gateway type.
    const uniqueId = `gps${mapping.imei}`;
    const deviceTypeId = parseInt(hwTypeId, 10);
    if (Number.isNaN(deviceTypeId)) {
      throw new Error("Wialon Hardware Type ID is not a valid integer.");
    }
    await this._call("unit/update_device_type", { itemId: unit.id, deviceTypeId, uniqueId }, sid);

    // 4. Update Placa
    await this._call("item/update_custom_property", { itemId: unit.id, name: "p_plate", value: mapping.placa }, sid);

    return unit;
  }

  /**
   * Send a telemetry message to a Wialon unit.
   * Currently a stub for actual message push.
   */
  async sendMessage(mapping, telemetry, sid) {
    if (!mapping.wialonUnitId) {
      console.warn(`Cannot send message: Mapping ${mapping.economico} has no wialonUnitId`);
      return;
    }

    console.log(`Pushing telemetry to Wialon Unit ${mapping.wialonUnitId} (${mapping.economico})`);
    // Here we would implement unit/add_message or similar
    // console.log("Telemetry payload:", JSON.stringify(telemetry));
  }

  /**
   * Main activation loop: Ensures all units exist and are linked.
   */
  async activateIntegration(integrationId, mappingIds = []) {
    const integration = await Integration.findById(integrationId);
    if (!integration) throw new Error("Integration not found");

    const wialonToken = integration.wialonToken || process.env.WIALON_API_TOKEN;
    if (!wialonToken) throw new Error("Wialon API Token not configured.");

    const query = { integrationId };
    if (mappingIds.length > 0) {
      query._id = { $in: mappingIds };
    }
    const mappings = await VehicleMapping.find(query);

    const results = [];
    let sid = null;

    try {
      sid = await this.login(wialonToken);

      for (const mapping of mappings) {
        try {
          const unit = await this.ensureUnitExists(mapping, integration, sid);
          
          mapping.wialonUnitId = unit.id.toString();
          mapping.status = "linkedToWialon";
          await mapping.save();

          results.push({ id: mapping._id, economico: mapping.economico, status: "success", wialonUnitId: unit.id });
        } catch (err) {
          console.error(`Error activating ${mapping.economico}:`, err);
          mapping.status = "error";
          await mapping.save();
          results.push({ id: mapping._id, economico: mapping.economico, status: "error", message: err.message });
        }
      }

      return { success: true, results };
    } finally {
      if (sid) {
        try {
          await this._call("core/logout", {}, sid);
        } catch (e) {}
      }
    }
  }

  /**
   * Compatibility wrapper
   */
  async importVehicles(integrationId, mappingIds = []) {
    return this.activateIntegration(integrationId, mappingIds);
  }

  /**
   * Fetch notifications (alerts) from Wialon resources.
   * Notifications are stored in resources (avl_resource).
   */
  async fetchNotifications(sid) {
    // 0x0400 = Notifications flag
    const params = {
      spec: {
        itemsType: "avl_resource",
        propName: "sys_name",
        propValueMask: "*",
        sortType: "sys_name"
      },
      force: 1,
      flags: 0x0400 | 0x01, 
      from: 0,
      to: 0
    };
    
    const data = await this._call("core/search_items", params, sid);
    const alerts = [];
    
    if (data.items) {
      for (const resource of data.items) {
        if (resource.unf) {
          Object.values(resource.unf).forEach(notification => {
            alerts.push({
              resourceId: resource.id,
              resourceName: resource.nm,
              ...notification
            });
          });
        }
      }
    }
    return alerts;
  }

  /**
   * Fetch recent events/messages from Wialon for a unit.
   */
  async getUnitEvents(unitId, from, to, sid) {
    const params = {
      itemId: parseInt(unitId, 10),
      timeFrom: from,
      timeTo: to,
      flags: 0,
      flags2: 0,
      mode: 0
    };
    return this._call("unit/get_events", params, sid);
  }

  /**
   * Build a Wialon-compatible WLN payload from a list of InboundMessage docs.
   * Format (semicolon separated, one record per line):
   *   DDMMYY;HHMMSS;DDMM.MMMM;NS;DDDMM.MMMM;EW;speed;course;height;sats
   * Reference: Wialon "exchange/import_messages" with WLN-like text input.
   */
  _buildWlnLines(messages) {
    const pad = (n, w) => String(n).padStart(w, "0");

    const toDDMM = (decimalDeg) => {
      const abs = Math.abs(decimalDeg);
      const deg = Math.floor(abs);
      const min = (abs - deg) * 60;
      return `${pad(deg, 2)}${min.toFixed(4).padStart(7, "0")}`;
    };
    const toDDDMM = (decimalDeg) => {
      const abs = Math.abs(decimalDeg);
      const deg = Math.floor(abs);
      const min = (abs - deg) * 60;
      return `${pad(deg, 3)}${min.toFixed(4).padStart(7, "0")}`;
    };

    const lines = [];
    for (const msg of messages) {
      const p = msg.position || {};
      const lat = Number(p.latitude);
      const lon = Number(p.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      const at = msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt || Date.now());
      const date = `${pad(at.getUTCDate(), 2)}${pad(at.getUTCMonth() + 1, 2)}${pad(at.getUTCFullYear() % 100, 2)}`;
      const time = `${pad(at.getUTCHours(), 2)}${pad(at.getUTCMinutes(), 2)}${pad(at.getUTCSeconds(), 2)}`;

      const speed = Number.isFinite(Number(p.speed)) ? Number(p.speed) : 0;
      const course = Number.isFinite(Number(p.direction)) ? Number(p.direction) : 0;
      const height = Number.isFinite(Number(p.altitude)) ? Number(p.altitude) : 0;
      const sats = Number.isFinite(Number(p.satellites)) ? Number(p.satellites) : 0;

      lines.push(
        [
          date,
          time,
          toDDMM(lat),
          lat >= 0 ? "N" : "S",
          toDDDMM(lon),
          lon >= 0 ? "E" : "W",
          speed,
          course,
          height,
          sats,
        ].join(";")
      );
    }
    return lines.join("\n");
  }

  /**
   * Upload a .wln payload to Wialon and trigger import_messages for the unit.
   * Uses native FormData / Blob (Node 18+).
   */
  async _importMessagesForUnit(unitId, wlnContent, sid) {
    const formData = new FormData();
    const eventHash = crypto.randomUUID();
    
    const params = { itemId: parseInt(unitId, 10), conversionType: "msgsToUnit" };
    
    // Wialon usually allows params and sid in the query string or as part of the form body.
    // For multipart/form-data, we can try adding them to the form data.
    formData.append("params", JSON.stringify(params));
    formData.append("eventHash", eventHash);
    formData.append("file", new Blob([wlnContent], { type: "text/plain" }), "messages.wln");

    const url = new URL(this.baseUrl);
    url.searchParams.append("svc", "exchange/import_messages");
    if (sid) url.searchParams.append("sid", sid);

    const response = await fetch(url.toString(), { 
      method: "POST", 
      body: formData 
    });

    const data = await response.json().catch(() => ({}));
    if (data?.error) {
      throw new Error(`Wialon import_messages error ${data.error}: ${this._getErrorText(data.error)}`);
    }
    return data;
  }

  /**
   * Push all pending InboundMessages for a single integration to Wialon.
   * Returns counts: { pushed, failed, skipped }.
   */
  async pushBatchToWialon(integrationId) {
    const integration = await Integration.findById(integrationId);
    if (!integration) throw new Error("Integration not found");

    const wialonToken = integration.wialonToken || process.env.WIALON_API_TOKEN;
    if (!wialonToken) {
      return { pushed: 0, failed: 0, skipped: 0, reason: "no-wialon-token" };
    }

    const MAX_ATTEMPTS = 5;
    const messages = await InboundMessage.find({ 
      integrationId, 
      wialonStatus: "pending",
      wialonAttempts: { $lt: MAX_ATTEMPTS }
    })
      .sort({ createdAt: 1 })
      .limit(BATCH_LIMIT)
      .populate("vehicleMappingId");

    if (messages.length === 0) {
      return { pushed: 0, failed: 0, skipped: 0 };
    }

    const groups = new Map();
    const unmatched = [];
    for (const msg of messages) {
      const unitId = msg.vehicleMappingId?.wialonUnitId;
      if (!unitId) { unmatched.push(msg); continue; }
      if (!groups.has(unitId)) groups.set(unitId, []);
      groups.get(unitId).push(msg);
    }

    for (const m of unmatched) {
      m.wialonStatus = "skipped";
      m.wialonError = "Mapping has no wialonUnitId";
      await m.save();
    }

    let pushed = 0;
    let failed = 0;
    let sid = null;
    try {
      sid = await this.login(wialonToken);

      for (const [unitId, msgs] of groups.entries()) {
        try {
          const wln = this._buildWlnLines(msgs);
          if (!wln) {
            for (const m of msgs) {
              m.wialonStatus = "skipped";
              m.wialonError = "No valid coordinates in payload";
              await m.save();
            }
            continue;
          }
          await this._importMessagesForUnit(unitId, wln, sid);
          for (const m of msgs) {
            m.wialonStatus = "pushed";
            m.wialonPushedAt = new Date();
            m.wialonAttempts = (m.wialonAttempts || 0) + 1;
            m.wialonError = undefined;
            await m.save();
          }
          pushed += msgs.length;
          console.log(`[wialon-flush] Pushed ${msgs.length} messages to unit ${unitId}`);
        } catch (err) {
          console.error(`[wialon-flush] Unit ${unitId} failed:`, err.message);
          for (const m of msgs) {
            m.wialonAttempts = (m.wialonAttempts || 0) + 1;
            m.wialonError = err.message;
            m.wialonStatus = m.wialonAttempts >= MAX_ATTEMPTS ? "failed" : "pending";
            await m.save();
          }
          failed += msgs.length;
        }
      }
    } finally {
      if (sid) {
        try { await this._call("core/logout", {}, sid); } catch (e) { /* ignore */ }
      }
    }

    return { pushed, failed, skipped: unmatched.length };
  }

  /**
   * Flush worker: process every integration that has pending messages.
   * Designed to be called on a setInterval.
   */
  async pushAllPending() {
    const integrationIds = await InboundMessage.distinct("integrationId", { 
      wialonStatus: "pending",
      wialonAttempts: { $lt: 5 }
    });
    if (integrationIds.length === 0) return { integrations: 0, pushed: 0, failed: 0, skipped: 0 };

    let totals = { integrations: 0, pushed: 0, failed: 0, skipped: 0 };
    for (const id of integrationIds) {
      try {
        const r = await this.pushBatchToWialon(id);
        totals.integrations += 1;
        totals.pushed += r.pushed || 0;
        totals.failed += r.failed || 0;
        totals.skipped += r.skipped || 0;
      } catch (err) {
        console.error(`[wialon-flush] Integration ${id} failed:`, err.message);
      }
    }
    return totals;
  }
}

export default new WialonIntegrationService();
