import { describe, it, expect } from "vitest";

import {
  canDeleteBoard,
  canEditBoard,
  canManageMembers,
  canMutateContent,
  canReportProgress,
  roleAtLeast,
} from "./permissions";

describe("permissions", () => {
  describe("canEditBoard / canDeleteBoard / canManageMembers", () => {
    it("разрешают только OWNER", () => {
      expect(canEditBoard("OWNER")).toBe(true);
      expect(canEditBoard("MEMBER")).toBe(false);
      expect(canEditBoard("CONTRIBUTOR")).toBe(false);
      expect(canEditBoard("VIEWER")).toBe(false);

      expect(canDeleteBoard("OWNER")).toBe(true);
      expect(canDeleteBoard("MEMBER")).toBe(false);
      expect(canDeleteBoard("CONTRIBUTOR")).toBe(false);

      expect(canManageMembers("OWNER")).toBe(true);
      expect(canManageMembers("MEMBER")).toBe(false);
      expect(canManageMembers("CONTRIBUTOR")).toBe(false);
    });
  });

  describe("canMutateContent", () => {
    it("разрешает OWNER и MEMBER, запрещает CONTRIBUTOR и VIEWER", () => {
      expect(canMutateContent("OWNER")).toBe(true);
      expect(canMutateContent("MEMBER")).toBe(true);
      expect(canMutateContent("CONTRIBUTOR")).toBe(false);
      expect(canMutateContent("VIEWER")).toBe(false);
    });
  });

  describe("canReportProgress", () => {
    it("разрешает всем кроме VIEWER", () => {
      expect(canReportProgress("OWNER")).toBe(true);
      expect(canReportProgress("MEMBER")).toBe(true);
      expect(canReportProgress("CONTRIBUTOR")).toBe(true);
      expect(canReportProgress("VIEWER")).toBe(false);
    });
  });

  describe("roleAtLeast", () => {
    it("корректно сравнивает иерархию", () => {
      expect(roleAtLeast("OWNER", "VIEWER")).toBe(true);
      expect(roleAtLeast("OWNER", "CONTRIBUTOR")).toBe(true);
      expect(roleAtLeast("MEMBER", "CONTRIBUTOR")).toBe(true);
      expect(roleAtLeast("CONTRIBUTOR", "VIEWER")).toBe(true);
      expect(roleAtLeast("CONTRIBUTOR", "MEMBER")).toBe(false);
      expect(roleAtLeast("VIEWER", "MEMBER")).toBe(false);
    });
  });
});
