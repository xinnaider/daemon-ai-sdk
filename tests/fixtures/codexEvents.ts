export const sessionLifecycleEvents = [
  {
    type: "thread.started",
    thread: { id: "thread_1", created: 1716854400000 },
    data: { prompt: "list files" },
  },
];

export const turnEvents = [
  {
    type: "turn.started",
    turn: { id: "turn_1", threadId: "thread_1", status: "in_progress" },
    data: {},
  },
  {
    type: "turn.completed",
    turn: { id: "turn_1", threadId: "thread_1", status: "completed" },
    data: { usage: { input_tokens: 50, output_tokens: 100 } },
  },
  {
    type: "turn.failed",
    turn: { id: "turn_2", threadId: "thread_1", status: "failed" },
    data: { error: { message: "rate limit exceeded" } },
  },
];

export const itemEvents = {
  agent_message: {
    type: "item.started",
    item: { id: "item_1", type: "agent_message", content: "" },
  },
  reasoning: {
    type: "item.started",
    item: { id: "item_2", type: "reasoning", content: "" },
  },
  command_execution: {
    type: "item.started",
    item: { id: "item_3", type: "command_execution", content: "ls -la" },
  },
  file_change: {
    type: "item.completed",
    item: { id: "item_4", type: "file_change", content: "src/index.ts" },
    data: { change: "modified" },
  },
  mcp_tool_call: {
    type: "item.started",
    item: { id: "item_5", type: "mcp_tool_call", content: "get_weather" },
  },
  web_search: {
    type: "item.started",
    item: { id: "item_6", type: "web_search", content: "query" },
  },
  todo_list: {
    type: "item.updated",
    item: { id: "item_7", type: "todo_list", content: "tasks" },
    data: { todos: ["task 1", "task 2"] },
  },
  error: {
    type: "item.completed",
    item: { id: "item_8", type: "error", content: "failed" },
    data: { error: { message: "command failed" } },
  },
};

export const errorEvent = {
  type: "error",
  error: { message: "connection lost" },
};

export const allCodexEvents = [
  ...sessionLifecycleEvents,
  ...turnEvents,
  ...Object.values(itemEvents),
  errorEvent,
];
