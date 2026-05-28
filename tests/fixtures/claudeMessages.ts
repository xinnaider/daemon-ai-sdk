export const assistantMessage = {
  type: "message",
  message: { role: "assistant", content: [{ type: "text", text: "hello world" }] },
};

export const userMessage = {
  type: "message",
  message: { role: "user", content: [{ type: "text", text: "list files" }] },
};

export const resultMessage = {
  type: "result",
  result: { status: "success", data: { files: ["src/index.ts"] } },
};

export const systemMessage = {
  type: "system",
  message: { role: "system", content: "system prompt" },
};

export const streamEventMessage = {
  type: "stream_event",
  event: "text_delta",
  data: { text: "hello" },
};

export const compactBoundaryMessage = {
  type: "compact_boundary",
  data: { before: "state before", after: "state after" },
};

export const statusMessage = {
  type: "status",
  status: "thinking",
  data: { detail: "analyzing code" },
};

export const localCommandOutputMessage = {
  type: "local_command_output",
  command: "ls -la",
  output: "file1.txt\nfile2.txt",
  exitCode: 0,
};

export const hookStartedMessage = {
  type: "hook_started",
  hook: "PreToolUse",
  data: { toolName: "read" },
};

export const hookProgressMessage = {
  type: "hook_progress",
  hook: "PostToolUse",
  data: { progress: 50 },
};

export const hookResponseMessage = {
  type: "hook_response",
  hook: "Notification",
  data: { response: "acknowledged" },
};

export const toolProgressMessage = {
  type: "tool_progress",
  tool: "Bash",
  data: { status: "running" },
};

export const authStatusMessage = {
  type: "auth_status",
  status: "pending",
  data: { provider: "github" },
};

export const taskNotificationMessage = {
  type: "task_notification",
  task: "subtask_1",
  data: { status: "completed" },
};

export const taskStartedMessage = {
  type: "task_started",
  task: "task_1",
  data: { description: "implement feature" },
};

export const taskProgressMessage = {
  type: "task_progress",
  task: "task_1",
  data: { progress: 30 },
};

export const filesPersistedMessage = {
  type: "files_persisted",
  files: ["src/new-file.ts"],
  data: {},
};

export const toolUseSummaryMessage = {
  type: "tool_use_summary",
  summary: { totalUses: 5, tools: ["Bash", "Read"] },
};

export const rateLimitMessage = {
  type: "rate_limit",
  data: { remaining: 10, resetAt: 1716854400000 },
};

export const promptSuggestionMessage = {
  type: "prompt_suggestion",
  suggestion: "try using git log",
  data: {},
};

export const hookNames = [
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "Notification",
  "UserPromptSubmit",
  "SessionStart",
  "SessionEnd",
  "Stop",
  "SubagentStart",
  "SubagentStop",
  "PreCompact",
  "PermissionRequest",
  "Setup",
  "TeammateIdle",
  "TaskCompleted",
  "ConfigChange",
  "WorktreeCreate",
  "WorktreeRemove",
];

export const allClaudeMessages = [
  assistantMessage,
  userMessage,
  resultMessage,
  systemMessage,
  streamEventMessage,
  compactBoundaryMessage,
  statusMessage,
  localCommandOutputMessage,
  hookStartedMessage,
  hookProgressMessage,
  hookResponseMessage,
  toolProgressMessage,
  authStatusMessage,
  taskNotificationMessage,
  taskStartedMessage,
  taskProgressMessage,
  filesPersistedMessage,
  toolUseSummaryMessage,
  rateLimitMessage,
  promptSuggestionMessage,
];

export const permissionRequestMessage = {
  type: "hook_started",
  hook: "PermissionRequest",
  data: { permission: "write", path: "src/file.ts" },
};
