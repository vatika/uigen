"use client";

import { Loader2 } from "lucide-react";

interface ToolInvocation {
  toolName: string;
  args?: Record<string, unknown>;
  state?: string;
  result?: unknown;
}

interface ToolInvocationDisplayProps {
  tool: ToolInvocation;
}

function getFileName(path: string): string {
  return path.split("/").pop() || path;
}

export function getToolMessage(tool: ToolInvocation): string {
  const { toolName, args } = tool;
  const path = args?.path as string | undefined;
  const fileName = path ? getFileName(path) : "file";

  if (toolName === "str_replace_editor") {
    const command = args?.command as string | undefined;
    switch (command) {
      case "create":
        return `Creating ${fileName}`;
      case "view":
        return `Viewing ${fileName}`;
      case "str_replace":
        return `Editing ${fileName}`;
      case "insert":
        return `Editing ${fileName}`;
      case "undo_edit":
        return `Undoing changes to ${fileName}`;
      default:
        return `Modifying ${fileName}`;
    }
  }

  if (toolName === "file_manager") {
    const command = args?.command as string | undefined;
    const newPath = args?.new_path as string | undefined;
    switch (command) {
      case "rename":
        const newFileName = newPath ? getFileName(newPath) : "new location";
        return `Renaming ${fileName} → ${newFileName}`;
      case "delete":
        return `Deleting ${fileName}`;
      default:
        return `Managing ${fileName}`;
    }
  }

  return toolName;
}

export function ToolInvocationDisplay({ tool }: ToolInvocationDisplayProps) {
  const isComplete = tool.state === "result" && tool.result;
  const message = getToolMessage(tool);

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs border border-neutral-200">
      {isComplete ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{message}</span>
    </div>
  );
}
