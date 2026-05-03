import { describe, it, expect } from "vitest";

import {
  canDeleteBoard,
  canEditBoard,
  canManageMembers,
  canMutateContent,
  roleAtLeast,
} from "./permissions";

describe("permissions", () => {
  describe("canEditBoard / canDeleteBoard / canManageMembers", () => {
    it("разрешают только OWNER", () => {
      expect(canEditBoard("OWNER")).toBe(true);
      expect(canEditBoard("MEMBER")).toBe(false);
      expect(canEditBoard("VIEWER")).toBe(false);

      expect(canDeleteBoard("OWNER")).toBe(true);
      expect(canDeleteBoard("MEMBER")).toBe(false);

      expect(canManageMembers("OWNER")).toBe(true);
      expect(canManageMembers("MEMBER")).toBe(false);
    });
  });

  describe("canMutateContent", () => {
    it("разрешает OWNER и MEMBER, запрещает VIEWER", () => {
      expect(canMutateContent("OWNER")).toBe(true);
      expect(canMutateContent("MEMBER")).toBe(true);
      expect(canMutateContent("VIEWER")).toBe(false);
    });
  });

  describe("roleAtLeast", () => {
    it("корректно сравнивает иерархию", () => {
      expect(roleAtLeast("OWNER", "VIEWER")).toBe(true);
      expect(roleAtLeast("OWNER", "MEMBER")).toBe(true);
      expect(roleAtLeast("OWNER", "OWNER")).toBe(true);
      expect(roleAtLeast("MEMBER", "VIEWER")).toBe(true);
      expect(roleAtLeast("MEMBER", "MEMBER")).toBe(true);
      expect(roleAtLeast("MEMBER", "OWNER")).toBe(false);
      expect(roleAtLeast("VIEWER", "VIEWER")).toBe(true);
      expect(roleAtLeast("VIEWER", "MEMBER")).toBe(false);
      expect(roleAtLeast("VIEWER", "OWNER")).toBe(false);
    });
  });
});
