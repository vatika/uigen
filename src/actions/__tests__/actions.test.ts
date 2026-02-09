import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createProject } from "../create-project";
import { getProject } from "../get-project";
import { getProjects } from "../get-projects";

describe("Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createProject", () => {
    test("creates project when user is authenticated", async () => {
      vi.mocked(getSession).mockResolvedValue({
        userId: "user-123",
        email: "test@example.com",
        expiresAt: new Date(),
      });

      const mockProject = {
        id: "project-1",
        name: "Test Project",
        userId: "user-123",
        messages: "[]",
        data: "{}",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(prisma.project.create).mockResolvedValue(mockProject);

      const result = await createProject({
        name: "Test Project",
        messages: [],
        data: {},
      });

      expect(getSession).toHaveBeenCalled();
      expect(prisma.project.create).toHaveBeenCalledWith({
        data: {
          name: "Test Project",
          userId: "user-123",
          messages: "[]",
          data: "{}",
        },
      });
      expect(result).toEqual(mockProject);
    });

    test("creates project with messages and file system data", async () => {
      vi.mocked(getSession).mockResolvedValue({
        userId: "user-123",
        email: "test@example.com",
        expiresAt: new Date(),
      });

      const messages = [
        { role: "user", content: "Create a button" },
        { role: "assistant", content: "Here is a button" },
      ];
      const data = {
        "/App.jsx": { type: "file", content: "export default App" },
      };

      vi.mocked(prisma.project.create).mockResolvedValue({
        id: "project-2",
        name: "UI Design",
        userId: "user-123",
        messages: JSON.stringify(messages),
        data: JSON.stringify(data),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await createProject({
        name: "UI Design",
        messages,
        data,
      });

      expect(prisma.project.create).toHaveBeenCalledWith({
        data: {
          name: "UI Design",
          userId: "user-123",
          messages: JSON.stringify(messages),
          data: JSON.stringify(data),
        },
      });
    });

    test("throws error when user is not authenticated", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      await expect(
        createProject({
          name: "Test Project",
          messages: [],
          data: {},
        })
      ).rejects.toThrow("Unauthorized");

      expect(prisma.project.create).not.toHaveBeenCalled();
    });

    test("handles complex nested data structures", async () => {
      vi.mocked(getSession).mockResolvedValue({
        userId: "user-123",
        email: "test@example.com",
        expiresAt: new Date(),
      });

      const complexData = {
        "/": { type: "directory", name: "/", path: "/" },
        "/components": { type: "directory", name: "components", path: "/components" },
        "/components/Button.jsx": {
          type: "file",
          name: "Button.jsx",
          path: "/components/Button.jsx",
          content: "export default function Button({ onClick, children }) { return <button onClick={onClick}>{children}</button>; }",
        },
      };

      vi.mocked(prisma.project.create).mockResolvedValue({
        id: "project-3",
        name: "Complex Project",
        userId: "user-123",
        messages: "[]",
        data: JSON.stringify(complexData),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await createProject({
        name: "Complex Project",
        messages: [],
        data: complexData,
      });

      expect(prisma.project.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          data: JSON.stringify(complexData),
        }),
      });
    });
  });

  describe("getProject", () => {
    test("returns project when found and user owns it", async () => {
      const mockProject = {
        id: "project-1",
        name: "Test Project",
        userId: "user-123",
        messages: JSON.stringify([{ role: "user", content: "Hello" }]),
        data: JSON.stringify({ "/App.jsx": { type: "file" } }),
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
      };

      vi.mocked(getSession).mockResolvedValue({
        userId: "user-123",
        email: "test@example.com",
        expiresAt: new Date(),
      });
      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject);

      const result = await getProject("project-1");

      expect(getSession).toHaveBeenCalled();
      expect(prisma.project.findUnique).toHaveBeenCalledWith({
        where: {
          id: "project-1",
          userId: "user-123",
        },
      });
      expect(result).toEqual({
        id: "project-1",
        name: "Test Project",
        messages: [{ role: "user", content: "Hello" }],
        data: { "/App.jsx": { type: "file" } },
        createdAt: mockProject.createdAt,
        updatedAt: mockProject.updatedAt,
      });
    });

    test("parses JSON messages and data correctly", async () => {
      const messages = [
        { role: "user", content: "Create a form" },
        { role: "assistant", content: "Done", toolInvocations: [{ tool: "create" }] },
      ];
      const data = {
        "/Form.jsx": { type: "file", content: "export default Form" },
      };

      vi.mocked(getSession).mockResolvedValue({
        userId: "user-456",
        email: "user@example.com",
        expiresAt: new Date(),
      });
      vi.mocked(prisma.project.findUnique).mockResolvedValue({
        id: "project-2",
        name: "Form Project",
        userId: "user-456",
        messages: JSON.stringify(messages),
        data: JSON.stringify(data),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await getProject("project-2");

      expect(result.messages).toEqual(messages);
      expect(result.data).toEqual(data);
    });

    test("throws error when user is not authenticated", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      await expect(getProject("project-1")).rejects.toThrow("Unauthorized");

      expect(prisma.project.findUnique).not.toHaveBeenCalled();
    });

    test("throws error when project is not found", async () => {
      vi.mocked(getSession).mockResolvedValue({
        userId: "user-123",
        email: "test@example.com",
        expiresAt: new Date(),
      });
      vi.mocked(prisma.project.findUnique).mockResolvedValue(null);

      await expect(getProject("nonexistent")).rejects.toThrow("Project not found");
    });

    test("throws error when project belongs to different user", async () => {
      vi.mocked(getSession).mockResolvedValue({
        userId: "user-123",
        email: "test@example.com",
        expiresAt: new Date(),
      });
      // The query includes userId in where clause, so findUnique returns null for wrong user
      vi.mocked(prisma.project.findUnique).mockResolvedValue(null);

      await expect(getProject("project-from-other-user")).rejects.toThrow("Project not found");
    });
  });

  describe("getProjects", () => {
    test("returns all projects for authenticated user", async () => {
      vi.mocked(getSession).mockResolvedValue({
        userId: "user-123",
        email: "test@example.com",
        expiresAt: new Date(),
      });

      const mockProjects = [
        { id: "project-1", name: "Project A", createdAt: new Date("2024-01-03"), updatedAt: new Date("2024-01-03") },
        { id: "project-2", name: "Project B", createdAt: new Date("2024-01-02"), updatedAt: new Date("2024-01-02") },
        { id: "project-3", name: "Project C", createdAt: new Date("2024-01-01"), updatedAt: new Date("2024-01-01") },
      ];
      vi.mocked(prisma.project.findMany).mockResolvedValue(mockProjects);

      const result = await getProjects();

      expect(getSession).toHaveBeenCalled();
      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-123",
        },
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result).toEqual(mockProjects);
    });

    test("returns empty array when user has no projects", async () => {
      vi.mocked(getSession).mockResolvedValue({
        userId: "user-new",
        email: "new@example.com",
        expiresAt: new Date(),
      });
      vi.mocked(prisma.project.findMany).mockResolvedValue([]);

      const result = await getProjects();

      expect(result).toEqual([]);
    });

    test("throws error when user is not authenticated", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      await expect(getProjects()).rejects.toThrow("Unauthorized");

      expect(prisma.project.findMany).not.toHaveBeenCalled();
    });

    test("returns projects ordered by updatedAt descending", async () => {
      vi.mocked(getSession).mockResolvedValue({
        userId: "user-123",
        email: "test@example.com",
        expiresAt: new Date(),
      });
      vi.mocked(prisma.project.findMany).mockResolvedValue([]);

      await getProjects();

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            updatedAt: "desc",
          },
        })
      );
    });

    test("only selects required fields", async () => {
      vi.mocked(getSession).mockResolvedValue({
        userId: "user-123",
        email: "test@example.com",
        expiresAt: new Date(),
      });
      vi.mocked(prisma.project.findMany).mockResolvedValue([]);

      await getProjects();

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      );
    });
  });

  describe("edge cases", () => {
    test("createProject handles empty project name", async () => {
      vi.mocked(getSession).mockResolvedValue({
        userId: "user-123",
        email: "test@example.com",
        expiresAt: new Date(),
      });
      vi.mocked(prisma.project.create).mockResolvedValue({
        id: "project-empty",
        name: "",
        userId: "user-123",
        messages: "[]",
        data: "{}",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await createProject({
        name: "",
        messages: [],
        data: {},
      });

      expect(result.name).toBe("");
    });

    test("createProject handles special characters in name", async () => {
      vi.mocked(getSession).mockResolvedValue({
        userId: "user-123",
        email: "test@example.com",
        expiresAt: new Date(),
      });
      vi.mocked(prisma.project.create).mockResolvedValue({
        id: "project-special",
        name: "My Project! @#$%",
        userId: "user-123",
        messages: "[]",
        data: "{}",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await createProject({
        name: "My Project! @#$%",
        messages: [],
        data: {},
      });

      expect(prisma.project.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "My Project! @#$%",
        }),
      });
      expect(result.name).toBe("My Project! @#$%");
    });

    test("getProject handles unicode content in messages", async () => {
      const messagesWithUnicode = [
        { role: "user", content: "Create a button with emoji 🚀" },
        { role: "assistant", content: "Here's your button! 按钮 ボタン" },
      ];

      vi.mocked(getSession).mockResolvedValue({
        userId: "user-123",
        email: "test@example.com",
        expiresAt: new Date(),
      });
      vi.mocked(prisma.project.findUnique).mockResolvedValue({
        id: "project-unicode",
        name: "Unicode Project",
        userId: "user-123",
        messages: JSON.stringify(messagesWithUnicode),
        data: "{}",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await getProject("project-unicode");

      expect(result.messages).toEqual(messagesWithUnicode);
    });
  });
});
