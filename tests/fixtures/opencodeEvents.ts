export const sessionLifecycleEvents = [
  {
    type: "session.created",
    session: { id: "session_1", label: "exploration" },
  },
  {
    type: "session.updated",
    session: { id: "session_1", label: "exploration-updated" },
  },
  {
    type: "session.deleted",
    session: { id: "session_1" },
  },
];

export const messageLifecycleEvents = [
  {
    type: "message.created",
    message: { id: "msg_1", role: "user", content: "hello" },
  },
  {
    type: "message.updated",
    message: { id: "msg_1", role: "assistant", content: "hi there" },
  },
];

export const partTextDeltaEvent = {
  type: "part.text_delta",
  part: { id: "part_1", text: "processing" },
  data: { delta: " data" },
};

export const toolStartEvent = {
  type: "tool.start",
  tool: { id: "tool_1", name: "Read" },
  data: { args: { path: "src/file.ts" } },
};

export const toolUpdateEvent = {
  type: "tool.update",
  tool: { id: "tool_1", name: "Read", status: "running" },
  data: { progress: 50 },
};

export const toolFinishEvent = {
  type: "tool.finish",
  tool: { id: "tool_1", name: "Read", status: "completed" },
  data: { result: "file content" },
};

export const permissionRequestEvent = {
  type: "permission.request",
  permission: { id: "perm_1", action: "write_file", path: "src/new.ts" },
  data: {},
};

export const permissionReplyEvent = {
  type: "permission.reply",
  permission: { id: "perm_1", action: "write_file", granted: true },
  data: {},
};

export const fileStatusUpdateEvent = {
  type: "file.status_update",
  file: { path: "src/index.ts" },
  data: { status: "modified" },
};

export const errorEvent = {
  type: "error",
  error: { message: "unexpected error", code: "E001" },
};

export const tokensCostEvent = {
  type: "tokens.cost",
  data: { inputTokens: 100, outputTokens: 50, cost: 0.002 },
};

export const childSessionEvent = {
  type: "child_session",
  session: { id: "child_1", parentId: "session_1" },
  data: {},
};

export const unknownEvent = {
  type: "unknown_event_type",
  data: { something: "unexpected" },
};

export const allOpenCodeEvents = [
  ...sessionLifecycleEvents,
  ...messageLifecycleEvents,
  partTextDeltaEvent,
  toolStartEvent,
  toolUpdateEvent,
  toolFinishEvent,
  permissionRequestEvent,
  permissionReplyEvent,
  fileStatusUpdateEvent,
  errorEvent,
  tokensCostEvent,
  childSessionEvent,
  unknownEvent,
];
