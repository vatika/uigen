import { describe, test, expect, beforeEach } from "vitest";
import { buildFileManagerTool } from "../file-manager";
import { VirtualFileSystem } from "@/lib/file-system";

describe("buildFileManagerTool", () => {
  let fileSystem: VirtualFileSystem;
  let tool: ReturnType<typeof buildFileManagerTool>;

  beforeEach(() => {
    fileSystem = new VirtualFileSystem();
    tool = buildFileManagerTool(fileSystem);
  });

  test("returns tool with correct description", () => {
    expect(tool.description).toContain("Rename or delete files");
  });

  describe("rename command", () => {
    test("successfully renames a file", async () => {
      fileSystem.createFile("/old.txt", "content");

      const result = await tool.execute({
        command: "rename",
        path: "/old.txt",
        new_path: "/new.txt",
      });

      expect(result).toEqual({
        success: true,
        message: "Successfully renamed /old.txt to /new.txt",
      });
      expect(fileSystem.exists("/old.txt")).toBe(false);
      expect(fileSystem.exists("/new.txt")).toBe(true);
      expect(fileSystem.readFile("/new.txt")).toBe("content");
    });

    test("renames a file to a different directory", async () => {
      fileSystem.createFile("/file.txt", "content");
      fileSystem.createDirectory("/docs");

      const result = await tool.execute({
        command: "rename",
        path: "/file.txt",
        new_path: "/docs/file.txt",
      });

      expect(result).toEqual({
        success: true,
        message: "Successfully renamed /file.txt to /docs/file.txt",
      });
      expect(fileSystem.exists("/file.txt")).toBe(false);
      expect(fileSystem.exists("/docs/file.txt")).toBe(true);
    });

    test("creates parent directories when renaming", async () => {
      fileSystem.createFile("/file.txt", "content");

      const result = await tool.execute({
        command: "rename",
        path: "/file.txt",
        new_path: "/deep/nested/path/file.txt",
      });

      expect(result).toEqual({
        success: true,
        message: "Successfully renamed /file.txt to /deep/nested/path/file.txt",
      });
      expect(fileSystem.exists("/deep")).toBe(true);
      expect(fileSystem.exists("/deep/nested")).toBe(true);
      expect(fileSystem.exists("/deep/nested/path")).toBe(true);
      expect(fileSystem.exists("/deep/nested/path/file.txt")).toBe(true);
    });

    test("renames a directory and all its contents", async () => {
      fileSystem.createDirectory("/src");
      fileSystem.createFile("/src/index.ts", "main");
      fileSystem.createDirectory("/src/components");
      fileSystem.createFile("/src/components/Button.tsx", "button");

      const result = await tool.execute({
        command: "rename",
        path: "/src",
        new_path: "/app",
      });

      expect(result).toEqual({
        success: true,
        message: "Successfully renamed /src to /app",
      });
      expect(fileSystem.exists("/src")).toBe(false);
      expect(fileSystem.exists("/app")).toBe(true);
      expect(fileSystem.exists("/app/index.ts")).toBe(true);
      expect(fileSystem.exists("/app/components")).toBe(true);
      expect(fileSystem.exists("/app/components/Button.tsx")).toBe(true);
      expect(fileSystem.readFile("/app/index.ts")).toBe("main");
      expect(fileSystem.readFile("/app/components/Button.tsx")).toBe("button");
    });

    test("returns error when new_path is not provided", async () => {
      fileSystem.createFile("/file.txt", "content");

      const result = await tool.execute({
        command: "rename",
        path: "/file.txt",
      });

      expect(result).toEqual({
        success: false,
        error: "new_path is required for rename command",
      });
      expect(fileSystem.exists("/file.txt")).toBe(true);
    });

    test("returns error when source file does not exist", async () => {
      const result = await tool.execute({
        command: "rename",
        path: "/nonexistent.txt",
        new_path: "/new.txt",
      });

      expect(result).toEqual({
        success: false,
        error: "Failed to rename /nonexistent.txt to /new.txt",
      });
    });

    test("returns error when destination already exists", async () => {
      fileSystem.createFile("/source.txt", "source content");
      fileSystem.createFile("/dest.txt", "dest content");

      const result = await tool.execute({
        command: "rename",
        path: "/source.txt",
        new_path: "/dest.txt",
      });

      expect(result).toEqual({
        success: false,
        error: "Failed to rename /source.txt to /dest.txt",
      });
      expect(fileSystem.readFile("/source.txt")).toBe("source content");
      expect(fileSystem.readFile("/dest.txt")).toBe("dest content");
    });

    test("returns error when trying to rename root directory", async () => {
      const result = await tool.execute({
        command: "rename",
        path: "/",
        new_path: "/root",
      });

      expect(result).toEqual({
        success: false,
        error: "Failed to rename / to /root",
      });
    });

    test("handles special characters in file names", async () => {
      fileSystem.createFile("/file with spaces.txt", "content");

      const result = await tool.execute({
        command: "rename",
        path: "/file with spaces.txt",
        new_path: "/file-without-spaces.txt",
      });

      expect(result).toEqual({
        success: true,
        message: "Successfully renamed /file with spaces.txt to /file-without-spaces.txt",
      });
      expect(fileSystem.exists("/file-without-spaces.txt")).toBe(true);
    });
  });

  describe("delete command", () => {
    test("successfully deletes a file", async () => {
      fileSystem.createFile("/file.txt", "content");

      const result = await tool.execute({
        command: "delete",
        path: "/file.txt",
      });

      expect(result).toEqual({
        success: true,
        message: "Successfully deleted /file.txt",
      });
      expect(fileSystem.exists("/file.txt")).toBe(false);
    });

    test("deletes an empty directory", async () => {
      fileSystem.createDirectory("/empty-dir");

      const result = await tool.execute({
        command: "delete",
        path: "/empty-dir",
      });

      expect(result).toEqual({
        success: true,
        message: "Successfully deleted /empty-dir",
      });
      expect(fileSystem.exists("/empty-dir")).toBe(false);
    });

    test("deletes a directory with contents recursively", async () => {
      fileSystem.createDirectory("/src");
      fileSystem.createFile("/src/index.ts", "main");
      fileSystem.createDirectory("/src/components");
      fileSystem.createFile("/src/components/Button.tsx", "button");

      const result = await tool.execute({
        command: "delete",
        path: "/src",
      });

      expect(result).toEqual({
        success: true,
        message: "Successfully deleted /src",
      });
      expect(fileSystem.exists("/src")).toBe(false);
      expect(fileSystem.exists("/src/index.ts")).toBe(false);
      expect(fileSystem.exists("/src/components")).toBe(false);
      expect(fileSystem.exists("/src/components/Button.tsx")).toBe(false);
    });

    test("returns error when file does not exist", async () => {
      const result = await tool.execute({
        command: "delete",
        path: "/nonexistent.txt",
      });

      expect(result).toEqual({
        success: false,
        error: "Failed to delete /nonexistent.txt",
      });
    });

    test("returns error when trying to delete root directory", async () => {
      const result = await tool.execute({
        command: "delete",
        path: "/",
      });

      expect(result).toEqual({
        success: false,
        error: "Failed to delete /",
      });
      expect(fileSystem.exists("/")).toBe(true);
    });

    test("handles special characters in file names", async () => {
      fileSystem.createFile("/file with spaces.txt", "content");

      const result = await tool.execute({
        command: "delete",
        path: "/file with spaces.txt",
      });

      expect(result).toEqual({
        success: true,
        message: "Successfully deleted /file with spaces.txt",
      });
    });
  });

  describe("invalid command", () => {
    test("returns error for invalid command", async () => {
      // @ts-expect-error - testing invalid command
      const result = await tool.execute({
        command: "invalid",
        path: "/file.txt",
      });

      expect(result).toEqual({
        success: false,
        error: "Invalid command",
      });
    });
  });

  describe("edge cases", () => {
    test("rename handles paths without leading slash", async () => {
      fileSystem.createFile("/file.txt", "content");

      const result = await tool.execute({
        command: "rename",
        path: "file.txt",
        new_path: "renamed.txt",
      });

      expect(result.success).toBe(true);
      expect(fileSystem.exists("/renamed.txt")).toBe(true);
    });

    test("delete handles paths without leading slash", async () => {
      fileSystem.createFile("/file.txt", "content");

      const result = await tool.execute({
        command: "delete",
        path: "file.txt",
      });

      expect(result.success).toBe(true);
      expect(fileSystem.exists("/file.txt")).toBe(false);
    });

    test("handles deeply nested file operations", async () => {
      fileSystem.createFile("/a/b/c/d/e/file.txt", "deep content");

      const deleteResult = await tool.execute({
        command: "delete",
        path: "/a/b/c/d/e/file.txt",
      });

      expect(deleteResult.success).toBe(true);
      expect(fileSystem.exists("/a/b/c/d/e/file.txt")).toBe(false);
      // Parent directories should still exist
      expect(fileSystem.exists("/a/b/c/d/e")).toBe(true);
    });

    test("preserves file content when renaming", async () => {
      const content = "line1\nline2\nline3\nwith special chars: éàü €$£";
      fileSystem.createFile("/original.txt", content);

      await tool.execute({
        command: "rename",
        path: "/original.txt",
        new_path: "/renamed.txt",
      });

      expect(fileSystem.readFile("/renamed.txt")).toBe(content);
    });
  });
});
