import { describe, test, expect, beforeEach, vi } from "vitest";
import {
  setHasAnonWork,
  getHasAnonWork,
  getAnonWorkData,
  clearAnonWork,
} from "../anon-work-tracker";

describe("anon-work-tracker", () => {
  let mockSessionStorage: Record<string, string>;

  beforeEach(() => {
    mockSessionStorage = {};

    // Mock sessionStorage
    vi.stubGlobal("sessionStorage", {
      getItem: vi.fn((key: string) => mockSessionStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockSessionStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockSessionStorage[key];
      }),
    });
  });

  describe("setHasAnonWork", () => {
    test("sets anonymous work flag and data when messages exist", () => {
      const messages = [{ role: "user", content: "Hello" }];
      const fileSystemData = { "/": { type: "directory" } };

      setHasAnonWork(messages, fileSystemData);

      expect(sessionStorage.setItem).toHaveBeenCalledWith("uigen_has_anon_work", "true");
      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        "uigen_anon_data",
        JSON.stringify({ messages, fileSystemData })
      );
    });

    test("sets anonymous work flag and data when fileSystemData has more than root", () => {
      const messages: any[] = [];
      const fileSystemData = {
        "/": { type: "directory" },
        "/App.jsx": { type: "file", content: "code" },
      };

      setHasAnonWork(messages, fileSystemData);

      expect(sessionStorage.setItem).toHaveBeenCalledWith("uigen_has_anon_work", "true");
    });

    test("does not set when messages are empty and only root exists", () => {
      const messages: any[] = [];
      const fileSystemData = { "/": { type: "directory" } };

      setHasAnonWork(messages, fileSystemData);

      expect(sessionStorage.setItem).not.toHaveBeenCalled();
    });

    test("does not set when both messages and fileSystemData are empty", () => {
      setHasAnonWork([], {});

      expect(sessionStorage.setItem).not.toHaveBeenCalled();
    });

    test("handles window undefined (SSR)", () => {
      const originalWindow = global.window;
      // @ts-expect-error - simulating SSR
      delete global.window;

      // Should not throw
      expect(() => setHasAnonWork([{ role: "user" }], {})).not.toThrow();

      global.window = originalWindow;
    });

    test("serializes complex messages correctly", () => {
      const messages = [
        { id: "1", role: "user", content: "Create a button" },
        { id: "2", role: "assistant", content: "Here is a button", toolInvocations: [] },
      ];
      const fileSystemData = {
        "/": { type: "directory" },
        "/Button.jsx": { type: "file", content: "export default Button" },
      };

      setHasAnonWork(messages, fileSystemData);

      const storedData = JSON.parse(mockSessionStorage["uigen_anon_data"]);
      expect(storedData.messages).toEqual(messages);
      expect(storedData.fileSystemData).toEqual(fileSystemData);
    });
  });

  describe("getHasAnonWork", () => {
    test("returns true when flag is set", () => {
      mockSessionStorage["uigen_has_anon_work"] = "true";

      expect(getHasAnonWork()).toBe(true);
    });

    test("returns false when flag is not set", () => {
      expect(getHasAnonWork()).toBe(false);
    });

    test("returns false when flag has different value", () => {
      mockSessionStorage["uigen_has_anon_work"] = "false";

      expect(getHasAnonWork()).toBe(false);
    });

    test("handles window undefined (SSR)", () => {
      const originalWindow = global.window;
      // @ts-expect-error - simulating SSR
      delete global.window;

      expect(getHasAnonWork()).toBe(false);

      global.window = originalWindow;
    });
  });

  describe("getAnonWorkData", () => {
    test("returns parsed data when available", () => {
      const data = {
        messages: [{ role: "user", content: "Hello" }],
        fileSystemData: { "/App.jsx": { type: "file" } },
      };
      mockSessionStorage["uigen_anon_data"] = JSON.stringify(data);

      const result = getAnonWorkData();

      expect(result).toEqual(data);
    });

    test("returns null when no data exists", () => {
      expect(getAnonWorkData()).toBeNull();
    });

    test("returns null for invalid JSON", () => {
      mockSessionStorage["uigen_anon_data"] = "invalid json {";

      expect(getAnonWorkData()).toBeNull();
    });

    test("handles window undefined (SSR)", () => {
      const originalWindow = global.window;
      // @ts-expect-error - simulating SSR
      delete global.window;

      expect(getAnonWorkData()).toBeNull();

      global.window = originalWindow;
    });

    test("parses complex nested data correctly", () => {
      const data = {
        messages: [
          { id: "1", role: "user", content: "Build a form" },
          {
            id: "2",
            role: "assistant",
            content: "Here is a form",
            toolInvocations: [
              {
                toolName: "str_replace_editor",
                args: { command: "create", path: "/Form.jsx" },
              },
            ],
          },
        ],
        fileSystemData: {
          "/": { type: "directory", name: "/", path: "/" },
          "/Form.jsx": {
            type: "file",
            name: "Form.jsx",
            path: "/Form.jsx",
            content: "export default function Form() { return <form></form>; }",
          },
        },
      };
      mockSessionStorage["uigen_anon_data"] = JSON.stringify(data);

      const result = getAnonWorkData();

      expect(result?.messages).toHaveLength(2);
      expect(result?.messages[1].toolInvocations).toBeDefined();
      expect(result?.fileSystemData["/Form.jsx"]).toBeDefined();
    });
  });

  describe("clearAnonWork", () => {
    test("removes both storage keys", () => {
      mockSessionStorage["uigen_has_anon_work"] = "true";
      mockSessionStorage["uigen_anon_data"] = "{}";

      clearAnonWork();

      expect(sessionStorage.removeItem).toHaveBeenCalledWith("uigen_has_anon_work");
      expect(sessionStorage.removeItem).toHaveBeenCalledWith("uigen_anon_data");
    });

    test("handles window undefined (SSR)", () => {
      const originalWindow = global.window;
      // @ts-expect-error - simulating SSR
      delete global.window;

      expect(() => clearAnonWork()).not.toThrow();

      global.window = originalWindow;
    });

    test("clears even when keys do not exist", () => {
      clearAnonWork();

      expect(sessionStorage.removeItem).toHaveBeenCalledWith("uigen_has_anon_work");
      expect(sessionStorage.removeItem).toHaveBeenCalledWith("uigen_anon_data");
    });
  });

  describe("integration scenarios", () => {
    test("full workflow: set, get, check, clear", () => {
      const messages = [{ role: "user", content: "Create a component" }];
      const fileSystemData = {
        "/": { type: "directory" },
        "/Component.jsx": { type: "file", content: "code" },
      };

      // Set anonymous work
      setHasAnonWork(messages, fileSystemData);

      // Check flag
      expect(getHasAnonWork()).toBe(true);

      // Get data
      const data = getAnonWorkData();
      expect(data?.messages).toEqual(messages);
      expect(data?.fileSystemData).toEqual(fileSystemData);

      // Clear
      clearAnonWork();

      // Verify cleared
      expect(getHasAnonWork()).toBe(false);
      expect(getAnonWorkData()).toBeNull();
    });

    test("updating anonymous work replaces previous data", () => {
      const firstMessages = [{ role: "user", content: "First message" }];
      const secondMessages = [{ role: "user", content: "Second message" }];
      const fileSystemData = { "/App.jsx": { type: "file" } };

      setHasAnonWork(firstMessages, fileSystemData);
      setHasAnonWork(secondMessages, fileSystemData);

      const data = getAnonWorkData();
      expect(data?.messages).toEqual(secondMessages);
    });
  });
});
