import { describe, test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolInvocationDisplay, getToolMessage } from "../ToolInvocationDisplay";

afterEach(() => {
  cleanup();
});

describe("getToolMessage", () => {
  describe("str_replace_editor tool", () => {
    test("returns 'Creating' message for create command", () => {
      const tool = {
        toolName: "str_replace_editor",
        args: { command: "create", path: "/components/Button.tsx" },
      };
      expect(getToolMessage(tool)).toBe("Creating Button.tsx");
    });

    test("returns 'Viewing' message for view command", () => {
      const tool = {
        toolName: "str_replace_editor",
        args: { command: "view", path: "/App.jsx" },
      };
      expect(getToolMessage(tool)).toBe("Viewing App.jsx");
    });

    test("returns 'Editing' message for str_replace command", () => {
      const tool = {
        toolName: "str_replace_editor",
        args: { command: "str_replace", path: "/lib/utils.ts" },
      };
      expect(getToolMessage(tool)).toBe("Editing utils.ts");
    });

    test("returns 'Editing' message for insert command", () => {
      const tool = {
        toolName: "str_replace_editor",
        args: { command: "insert", path: "/index.tsx" },
      };
      expect(getToolMessage(tool)).toBe("Editing index.tsx");
    });

    test("returns 'Undoing changes' message for undo_edit command", () => {
      const tool = {
        toolName: "str_replace_editor",
        args: { command: "undo_edit", path: "/App.jsx" },
      };
      expect(getToolMessage(tool)).toBe("Undoing changes to App.jsx");
    });

    test("returns 'Modifying' for unknown command", () => {
      const tool = {
        toolName: "str_replace_editor",
        args: { command: "unknown", path: "/test.js" },
      };
      expect(getToolMessage(tool)).toBe("Modifying test.js");
    });
  });

  describe("file_manager tool", () => {
    test("returns 'Renaming' message with both file names", () => {
      const tool = {
        toolName: "file_manager",
        args: { command: "rename", path: "/old.tsx", new_path: "/new.tsx" },
      };
      expect(getToolMessage(tool)).toBe("Renaming old.tsx → new.tsx");
    });

    test("returns 'Deleting' message for delete command", () => {
      const tool = {
        toolName: "file_manager",
        args: { command: "delete", path: "/unused.tsx" },
      };
      expect(getToolMessage(tool)).toBe("Deleting unused.tsx");
    });

    test("returns 'Managing' for unknown command", () => {
      const tool = {
        toolName: "file_manager",
        args: { command: "unknown", path: "/file.js" },
      };
      expect(getToolMessage(tool)).toBe("Managing file.js");
    });
  });

  describe("unknown tool", () => {
    test("returns tool name for unknown tools", () => {
      const tool = {
        toolName: "some_other_tool",
        args: {},
      };
      expect(getToolMessage(tool)).toBe("some_other_tool");
    });
  });

  describe("edge cases", () => {
    test("handles missing path gracefully", () => {
      const tool = {
        toolName: "str_replace_editor",
        args: { command: "create" },
      };
      expect(getToolMessage(tool)).toBe("Creating file");
    });

    test("handles missing args gracefully", () => {
      const tool = {
        toolName: "str_replace_editor",
      };
      expect(getToolMessage(tool)).toBe("Modifying file");
    });
  });
});

describe("ToolInvocationDisplay component", () => {
  test("renders message with spinner when in progress", () => {
    const tool = {
      toolName: "str_replace_editor",
      args: { command: "create", path: "/App.jsx" },
      state: "pending",
    };
    render(<ToolInvocationDisplay tool={tool} />);
    expect(screen.getByText("Creating App.jsx")).toBeDefined();
  });

  test("renders message with green dot when complete", () => {
    const tool = {
      toolName: "str_replace_editor",
      args: { command: "create", path: "/App.jsx" },
      state: "result",
      result: { success: true },
    };
    render(<ToolInvocationDisplay tool={tool} />);
    expect(screen.getByText("Creating App.jsx")).toBeDefined();
  });

  test("renders file_manager rename message", () => {
    const tool = {
      toolName: "file_manager",
      args: { command: "rename", path: "/old.tsx", new_path: "/components/New.tsx" },
      state: "result",
      result: { success: true },
    };
    render(<ToolInvocationDisplay tool={tool} />);
    expect(screen.getByText("Renaming old.tsx → New.tsx")).toBeDefined();
  });
});
