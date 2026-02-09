import { describe, test, expect, vi, beforeEach } from "vitest";
import { buildStrReplaceTool } from "../str-replace";
import { VirtualFileSystem } from "@/lib/file-system";

describe("buildStrReplaceTool", () => {
  let fileSystem: VirtualFileSystem;
  let tool: ReturnType<typeof buildStrReplaceTool>;

  beforeEach(() => {
    fileSystem = new VirtualFileSystem();
    tool = buildStrReplaceTool(fileSystem);
  });

  test("returns tool with correct id and structure", () => {
    expect(tool.id).toBe("str_replace_editor");
    expect(tool.parameters).toBeDefined();
    expect(tool.execute).toBeInstanceOf(Function);
  });

  describe("view command", () => {
    test("views file content with line numbers", async () => {
      fileSystem.createFile("/test.txt", "line1\nline2\nline3");

      const result = await tool.execute({
        command: "view",
        path: "/test.txt",
      });

      expect(result).toBe("1\tline1\n2\tline2\n3\tline3");
    });

    test("views file content with view_range", async () => {
      fileSystem.createFile("/test.txt", "line1\nline2\nline3\nline4\nline5");

      const result = await tool.execute({
        command: "view",
        path: "/test.txt",
        view_range: [2, 4],
      });

      expect(result).toBe("2\tline2\n3\tline3\n4\tline4");
    });

    test("views file content to end with -1 in view_range", async () => {
      fileSystem.createFile("/test.txt", "line1\nline2\nline3\nline4\nline5");

      const result = await tool.execute({
        command: "view",
        path: "/test.txt",
        view_range: [3, -1],
      });

      expect(result).toBe("3\tline3\n4\tline4\n5\tline5");
    });

    test("views directory contents", async () => {
      fileSystem.createDirectory("/src");
      fileSystem.createFile("/src/index.ts", "");
      fileSystem.createDirectory("/src/components");

      const result = await tool.execute({
        command: "view",
        path: "/src",
      });

      expect(result).toBe("[DIR] components\n[FILE] index.ts");
    });

    test("returns error for non-existent file", async () => {
      const result = await tool.execute({
        command: "view",
        path: "/nonexistent.txt",
      });

      expect(result).toBe("File not found: /nonexistent.txt");
    });

    test("views empty file", async () => {
      fileSystem.createFile("/empty.txt", "");

      const result = await tool.execute({
        command: "view",
        path: "/empty.txt",
      });

      expect(result).toBe("1\t");
    });

    test("views empty directory", async () => {
      fileSystem.createDirectory("/empty");

      const result = await tool.execute({
        command: "view",
        path: "/empty",
      });

      expect(result).toBe("(empty directory)");
    });
  });

  describe("create command", () => {
    test("creates a new file with content", async () => {
      const result = await tool.execute({
        command: "create",
        path: "/new-file.txt",
        file_text: "Hello, World!",
      });

      expect(result).toBe("File created: /new-file.txt");
      expect(fileSystem.readFile("/new-file.txt")).toBe("Hello, World!");
    });

    test("creates a new file with empty content when file_text is not provided", async () => {
      const result = await tool.execute({
        command: "create",
        path: "/empty-file.txt",
      });

      expect(result).toBe("File created: /empty-file.txt");
      expect(fileSystem.readFile("/empty-file.txt")).toBe("");
    });

    test("creates parent directories automatically", async () => {
      const result = await tool.execute({
        command: "create",
        path: "/deep/nested/path/file.txt",
        file_text: "nested content",
      });

      expect(result).toBe("File created: /deep/nested/path/file.txt");
      expect(fileSystem.exists("/deep")).toBe(true);
      expect(fileSystem.exists("/deep/nested")).toBe(true);
      expect(fileSystem.exists("/deep/nested/path")).toBe(true);
      expect(fileSystem.readFile("/deep/nested/path/file.txt")).toBe("nested content");
    });

    test("returns error when file already exists", async () => {
      fileSystem.createFile("/existing.txt", "old content");

      const result = await tool.execute({
        command: "create",
        path: "/existing.txt",
        file_text: "new content",
      });

      expect(result).toBe("Error: File already exists: /existing.txt");
      expect(fileSystem.readFile("/existing.txt")).toBe("old content");
    });
  });

  describe("str_replace command", () => {
    test("replaces string in file", async () => {
      fileSystem.createFile("/test.txt", "Hello World");

      const result = await tool.execute({
        command: "str_replace",
        path: "/test.txt",
        old_str: "World",
        new_str: "Universe",
      });

      expect(result).toBe("Replaced 1 occurrence(s) of the string in /test.txt");
      expect(fileSystem.readFile("/test.txt")).toBe("Hello Universe");
    });

    test("replaces all occurrences of string", async () => {
      fileSystem.createFile("/test.txt", "foo bar foo baz foo");

      const result = await tool.execute({
        command: "str_replace",
        path: "/test.txt",
        old_str: "foo",
        new_str: "qux",
      });

      expect(result).toBe("Replaced 3 occurrence(s) of the string in /test.txt");
      expect(fileSystem.readFile("/test.txt")).toBe("qux bar qux baz qux");
    });

    test("replaces with empty string", async () => {
      fileSystem.createFile("/test.txt", "Hello World");

      const result = await tool.execute({
        command: "str_replace",
        path: "/test.txt",
        old_str: " World",
        new_str: "",
      });

      expect(result).toBe("Replaced 1 occurrence(s) of the string in /test.txt");
      expect(fileSystem.readFile("/test.txt")).toBe("Hello");
    });

    test("replaces multiline strings", async () => {
      fileSystem.createFile("/test.txt", "line1\nline2\nline3");

      const result = await tool.execute({
        command: "str_replace",
        path: "/test.txt",
        old_str: "line1\nline2",
        new_str: "replaced",
      });

      expect(result).toBe("Replaced 1 occurrence(s) of the string in /test.txt");
      expect(fileSystem.readFile("/test.txt")).toBe("replaced\nline3");
    });

    test("returns error when file not found", async () => {
      const result = await tool.execute({
        command: "str_replace",
        path: "/nonexistent.txt",
        old_str: "foo",
        new_str: "bar",
      });

      expect(result).toBe("Error: File not found: /nonexistent.txt");
    });

    test("returns error when string not found in file", async () => {
      fileSystem.createFile("/test.txt", "Hello World");

      const result = await tool.execute({
        command: "str_replace",
        path: "/test.txt",
        old_str: "foo",
        new_str: "bar",
      });

      expect(result).toBe('Error: String not found in file: "foo"');
    });

    test("returns error when trying to replace in directory", async () => {
      fileSystem.createDirectory("/src");

      const result = await tool.execute({
        command: "str_replace",
        path: "/src",
        old_str: "foo",
        new_str: "bar",
      });

      expect(result).toBe("Error: Cannot edit a directory: /src");
    });

    test("handles special regex characters in old_str", async () => {
      fileSystem.createFile("/test.txt", "function() { return true; }");

      const result = await tool.execute({
        command: "str_replace",
        path: "/test.txt",
        old_str: "function()",
        new_str: "myFunc()",
      });

      expect(result).toBe("Replaced 1 occurrence(s) of the string in /test.txt");
      expect(fileSystem.readFile("/test.txt")).toBe("myFunc() { return true; }");
    });

    test("uses empty strings when old_str or new_str not provided", async () => {
      fileSystem.createFile("/test.txt", "Hello World");

      const result = await tool.execute({
        command: "str_replace",
        path: "/test.txt",
        old_str: undefined,
        new_str: "bar",
      });

      expect(result).toBe('Error: String not found in file: ""');
    });
  });

  describe("insert command", () => {
    test("inserts text at specified line", async () => {
      fileSystem.createFile("/test.txt", "line1\nline2\nline3");

      const result = await tool.execute({
        command: "insert",
        path: "/test.txt",
        insert_line: 1,
        new_str: "inserted",
      });

      expect(result).toBe("Text inserted at line 1 in /test.txt");
      expect(fileSystem.readFile("/test.txt")).toBe("line1\ninserted\nline2\nline3");
    });

    test("inserts text at beginning of file", async () => {
      fileSystem.createFile("/test.txt", "line1\nline2");

      const result = await tool.execute({
        command: "insert",
        path: "/test.txt",
        insert_line: 0,
        new_str: "first",
      });

      expect(result).toBe("Text inserted at line 0 in /test.txt");
      expect(fileSystem.readFile("/test.txt")).toBe("first\nline1\nline2");
    });

    test("inserts text at end of file", async () => {
      fileSystem.createFile("/test.txt", "line1\nline2");

      const result = await tool.execute({
        command: "insert",
        path: "/test.txt",
        insert_line: 2,
        new_str: "last",
      });

      expect(result).toBe("Text inserted at line 2 in /test.txt");
      expect(fileSystem.readFile("/test.txt")).toBe("line1\nline2\nlast");
    });

    test("inserts multiline text", async () => {
      fileSystem.createFile("/test.txt", "line1\nline3");

      const result = await tool.execute({
        command: "insert",
        path: "/test.txt",
        insert_line: 1,
        new_str: "line2a\nline2b",
      });

      expect(result).toBe("Text inserted at line 1 in /test.txt");
      expect(fileSystem.readFile("/test.txt")).toBe("line1\nline2a\nline2b\nline3");
    });

    test("returns error for invalid line number", async () => {
      fileSystem.createFile("/test.txt", "line1\nline2");

      const result = await tool.execute({
        command: "insert",
        path: "/test.txt",
        insert_line: 10,
        new_str: "text",
      });

      expect(result).toBe("Error: Invalid line number: 10. File has 2 lines.");
    });

    test("returns error for negative line number", async () => {
      fileSystem.createFile("/test.txt", "line1\nline2");

      const result = await tool.execute({
        command: "insert",
        path: "/test.txt",
        insert_line: -1,
        new_str: "text",
      });

      expect(result).toBe("Error: Invalid line number: -1. File has 2 lines.");
    });

    test("returns error when file not found", async () => {
      const result = await tool.execute({
        command: "insert",
        path: "/nonexistent.txt",
        insert_line: 0,
        new_str: "text",
      });

      expect(result).toBe("Error: File not found: /nonexistent.txt");
    });

    test("returns error when trying to insert in directory", async () => {
      fileSystem.createDirectory("/src");

      const result = await tool.execute({
        command: "insert",
        path: "/src",
        insert_line: 0,
        new_str: "text",
      });

      expect(result).toBe("Error: Cannot edit a directory: /src");
    });

    test("uses default values when insert_line or new_str not provided", async () => {
      fileSystem.createFile("/test.txt", "line1\nline2");

      const result = await tool.execute({
        command: "insert",
        path: "/test.txt",
      });

      expect(result).toBe("Text inserted at line 0 in /test.txt");
      expect(fileSystem.readFile("/test.txt")).toBe("\nline1\nline2");
    });
  });

  describe("undo_edit command", () => {
    test("returns not supported message", async () => {
      const result = await tool.execute({
        command: "undo_edit",
        path: "/test.txt",
      });

      expect(result).toBe(
        "Error: undo_edit command is not supported in this version. Use str_replace to revert changes."
      );
    });
  });

  describe("edge cases", () => {
    test("handles paths without leading slash", async () => {
      const result = await tool.execute({
        command: "create",
        path: "test.txt",
        file_text: "content",
      });

      expect(result).toBe("File created: /test.txt");
      expect(fileSystem.exists("/test.txt")).toBe(true);
    });

    test("handles paths with double slashes", async () => {
      const result = await tool.execute({
        command: "create",
        path: "//path//to//file.txt",
        file_text: "content",
      });

      expect(result).toBe("File created: /path/to/file.txt");
      expect(fileSystem.exists("/path/to/file.txt")).toBe(true);
    });

    test("handles empty file content in various commands", async () => {
      fileSystem.createFile("/empty.txt", "");

      // View empty file
      const viewResult = await tool.execute({
        command: "view",
        path: "/empty.txt",
      });
      expect(viewResult).toBe("1\t");

      // Insert into empty file
      const insertResult = await tool.execute({
        command: "insert",
        path: "/empty.txt",
        insert_line: 0,
        new_str: "first line",
      });
      expect(insertResult).toBe("Text inserted at line 0 in /empty.txt");
      expect(fileSystem.readFile("/empty.txt")).toBe("first line\n");
    });
  });
});
