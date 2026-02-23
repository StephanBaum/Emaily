import { describe, it, expect } from "vitest";
import {
  TRUST_LEVEL_ORDER,
  DEFAULT_PREFERENCES,
  isValidThreadStatus,
  isValidTrustLevel,
  isValidTagAIAction,
  isValidMailboxPermission,
  compareTrustLevels,
} from "../src/types";
import type { TrustLevel } from "../src/types";

// ---------------------------------------------------------------------------
// TRUST_LEVEL_ORDER
// ---------------------------------------------------------------------------
describe("TRUST_LEVEL_ORDER", () => {
  it("contains all four trust levels", () => {
    expect(Object.keys(TRUST_LEVEL_ORDER)).toHaveLength(4);
    expect(TRUST_LEVEL_ORDER).toHaveProperty("stranger");
    expect(TRUST_LEVEL_ORDER).toHaveProperty("known");
    expect(TRUST_LEVEL_ORDER).toHaveProperty("trusted");
    expect(TRUST_LEVEL_ORDER).toHaveProperty("vip");
  });

  it("has values in ascending order (stranger < known < trusted < vip)", () => {
    expect(TRUST_LEVEL_ORDER.stranger).toBeLessThan(TRUST_LEVEL_ORDER.known);
    expect(TRUST_LEVEL_ORDER.known).toBeLessThan(TRUST_LEVEL_ORDER.trusted);
    expect(TRUST_LEVEL_ORDER.trusted).toBeLessThan(TRUST_LEVEL_ORDER.vip);
  });

  it("has sequential values starting from 0 with no gaps", () => {
    const values = Object.values(TRUST_LEVEL_ORDER).sort((a, b) => a - b);
    expect(values[0]).toBe(0);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBe(values[i - 1] + 1);
    }
  });

  it("maps each level to the expected numeric value", () => {
    expect(TRUST_LEVEL_ORDER.stranger).toBe(0);
    expect(TRUST_LEVEL_ORDER.known).toBe(1);
    expect(TRUST_LEVEL_ORDER.trusted).toBe(2);
    expect(TRUST_LEVEL_ORDER.vip).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_PREFERENCES
// ---------------------------------------------------------------------------
describe("DEFAULT_PREFERENCES", () => {
  it("has all required top-level properties", () => {
    expect(DEFAULT_PREFERENCES).toHaveProperty("theme");
    expect(DEFAULT_PREFERENCES).toHaveProperty("density");
    expect(DEFAULT_PREFERENCES).toHaveProperty("dateFormat");
    expect(DEFAULT_PREFERENCES).toHaveProperty("previewLines");
    expect(DEFAULT_PREFERENCES).toHaveProperty("notifications");
  });

  it('defaults theme to "system"', () => {
    expect(DEFAULT_PREFERENCES.theme).toBe("system");
  });

  it('defaults density to "comfortable"', () => {
    expect(DEFAULT_PREFERENCES.density).toBe("comfortable");
  });

  it('defaults dateFormat to "relative"', () => {
    expect(DEFAULT_PREFERENCES.dateFormat).toBe("relative");
  });

  it("defaults previewLines to 2", () => {
    expect(DEFAULT_PREFERENCES.previewLines).toBe(2);
  });

  describe("notifications", () => {
    it("has all required notification properties", () => {
      const { notifications } = DEFAULT_PREFERENCES;
      expect(notifications).toHaveProperty("browser");
      expect(notifications).toHaveProperty("sound");
      expect(notifications).toHaveProperty("digestEmail");
    });

    it("defaults browser notifications to true", () => {
      expect(DEFAULT_PREFERENCES.notifications.browser).toBe(true);
    });

    it("defaults sound to false", () => {
      expect(DEFAULT_PREFERENCES.notifications.sound).toBe(false);
    });

    it("defaults digestEmail to false", () => {
      expect(DEFAULT_PREFERENCES.notifications.digestEmail).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// isValidThreadStatus
// ---------------------------------------------------------------------------
describe("isValidThreadStatus", () => {
  const validStatuses = ["open", "archived", "snoozed", "quarantined", "trashed"];

  it.each(validStatuses)('returns true for valid status "%s"', (status) => {
    expect(isValidThreadStatus(status)).toBe(true);
  });

  it("returns false for invalid statuses", () => {
    expect(isValidThreadStatus("deleted")).toBe(false);
    expect(isValidThreadStatus("pending")).toBe(false);
    expect(isValidThreadStatus("OPEN")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidThreadStatus("")).toBe(false);
  });

  it("returns false for string with extra whitespace", () => {
    expect(isValidThreadStatus(" open")).toBe(false);
    expect(isValidThreadStatus("open ")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidTrustLevel
// ---------------------------------------------------------------------------
describe("isValidTrustLevel", () => {
  const validLevels = ["stranger", "known", "trusted", "vip"];

  it.each(validLevels)('returns true for valid level "%s"', (level) => {
    expect(isValidTrustLevel(level)).toBe(true);
  });

  it("returns false for invalid levels", () => {
    expect(isValidTrustLevel("unknown")).toBe(false);
    expect(isValidTrustLevel("VIP")).toBe(false);
    expect(isValidTrustLevel("admin")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidTrustLevel("")).toBe(false);
  });

  it("returns false for numeric strings", () => {
    expect(isValidTrustLevel("0")).toBe(false);
    expect(isValidTrustLevel("3")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidTagAIAction
// ---------------------------------------------------------------------------
describe("isValidTagAIAction", () => {
  const validActions = [
    "none",
    "draft",
    "research_draft",
    "auto_reply",
    "archive",
    "quarantine",
    "notify",
  ];

  it.each(validActions)('returns true for valid action "%s"', (action) => {
    expect(isValidTagAIAction(action)).toBe(true);
  });

  it("returns false for invalid actions", () => {
    expect(isValidTagAIAction("delete")).toBe(false);
    expect(isValidTagAIAction("NONE")).toBe(false);
    expect(isValidTagAIAction("auto-reply")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidTagAIAction("")).toBe(false);
  });

  it("returns false for partial matches", () => {
    expect(isValidTagAIAction("research")).toBe(false);
    expect(isValidTagAIAction("auto")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidMailboxPermission
// ---------------------------------------------------------------------------
describe("isValidMailboxPermission", () => {
  const validPermissions = ["read", "write", "admin"];

  it.each(validPermissions)('returns true for valid permission "%s"', (perm) => {
    expect(isValidMailboxPermission(perm)).toBe(true);
  });

  it("returns false for invalid permissions", () => {
    expect(isValidMailboxPermission("execute")).toBe(false);
    expect(isValidMailboxPermission("READ")).toBe(false);
    expect(isValidMailboxPermission("owner")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidMailboxPermission("")).toBe(false);
  });

  it("returns false for substring matches", () => {
    expect(isValidMailboxPermission("readwrite")).toBe(false);
    expect(isValidMailboxPermission("ad")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// compareTrustLevels
// ---------------------------------------------------------------------------
describe("compareTrustLevels", () => {
  it("returns 0 when comparing the same level", () => {
    const levels: TrustLevel[] = ["stranger", "known", "trusted", "vip"];
    for (const level of levels) {
      expect(compareTrustLevels(level, level)).toBe(0);
    }
  });

  it("returns a negative number when a < b", () => {
    expect(compareTrustLevels("stranger", "known")).toBeLessThan(0);
    expect(compareTrustLevels("stranger", "vip")).toBeLessThan(0);
    expect(compareTrustLevels("known", "trusted")).toBeLessThan(0);
    expect(compareTrustLevels("trusted", "vip")).toBeLessThan(0);
  });

  it("returns a positive number when a > b", () => {
    expect(compareTrustLevels("vip", "stranger")).toBeGreaterThan(0);
    expect(compareTrustLevels("trusted", "known")).toBeGreaterThan(0);
    expect(compareTrustLevels("known", "stranger")).toBeGreaterThan(0);
  });

  it("can be used to sort trust levels ascending", () => {
    const levels: TrustLevel[] = ["vip", "stranger", "trusted", "known"];
    const sorted = [...levels].sort(compareTrustLevels);
    expect(sorted).toEqual(["stranger", "known", "trusted", "vip"]);
  });

  it("returns the correct numeric difference", () => {
    expect(compareTrustLevels("stranger", "vip")).toBe(-3);
    expect(compareTrustLevels("vip", "stranger")).toBe(3);
    expect(compareTrustLevels("known", "trusted")).toBe(-1);
  });
});
