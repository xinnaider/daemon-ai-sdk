import { opencodeActions } from "../src/adapters/providers/opencode/actions.js";
import { codexActions } from "../src/adapters/providers/codex/actions.js";
import { claudeActions } from "../src/adapters/providers/claude/actions.js";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const opencodeEventMapping: Record<string, string[]> = {
  "session.created": ["session.discovered"],
  "child_session": ["session.discovered"],
  "session.updated": ["session.updated"],
  "session.deleted": ["session.deleted"],
  "message.created": ["message.started"],
  "message.updated": ["message.delta", "message.completed"],
  "part.text_delta": ["message.delta"],
  "tool.start": ["tool.started"],
  "tool.update": ["tool.delta"],
  "tool.finish": ["tool.completed"],
  "permission.request": ["permission.requested"],
  "permission.reply": ["permission.resolved"],
  "file.status_update": ["file.changed"],
  "error": ["run.failed"],
  "tokens.cost": ["usage.updated"],
};

const codexEventMapping: Record<string, string[]> = {
  "thread.started": ["session.discovered"],
  "turn.started": ["run.started"],
  "turn.completed": ["usage.updated", "run.completed"],
  "turn.failed": ["run.failed"],
  "item.started (agent_message)": ["message.started", "message.delta", "message.completed"],
  "item.started (reasoning)": ["reasoning.started", "reasoning.delta", "reasoning.completed"],
  "item.started (command_execution)": ["tool.started", "tool.delta", "tool.completed"],
  "item.started (command_execution, error)": ["tool.started", "tool.delta", "tool.failed"],
  "item.started (file_change)": ["file.changed"],
  "item.started (mcp_tool_call)": ["tool.started", "tool.completed"],
  "item.started (web_search)": ["tool.started", "tool.completed"],
  "item.started (todo_list)": ["todo.updated"],
  "item.started (error)": ["tool.failed"],
  "item.updated (agent_message)": ["message.started", "message.delta", "message.completed"],
  "item.updated (reasoning)": ["reasoning.started", "reasoning.delta", "reasoning.completed"],
  "item.updated (command_execution)": ["tool.started", "tool.delta", "tool.completed"],
  "item.updated (file_change)": ["file.changed"],
  "item.updated (todo_list)": ["todo.updated"],
  "item.completed (agent_message)": ["message.started", "message.delta", "message.completed"],
  "item.completed (reasoning)": ["reasoning.started", "reasoning.delta", "reasoning.completed"],
  "item.completed (command_execution)": ["tool.started", "tool.delta", "tool.completed"],
  "item.completed (file_change)": ["file.changed"],
  "item.completed (todo_list)": ["todo.updated"],
  "error": ["run.failed"],
};

const claudeEventMapping: Record<string, string[]> = {
  "message (assistant/user)": ["message.started", "message.delta", "message.completed"],
  "result (success)": ["run.completed"],
  "result (failed)": ["run.failed"],
  "stream_event": ["message.delta"],
  "status": ["run.started"],
  "local_command_output": ["tool.started", "tool.completed"],
  "hook_started (PermissionRequest)": ["permission.requested"],
  "hook_started (other)": ["tool.started"],
  "hook_progress": ["tool.delta"],
  "hook_response": ["tool.completed"],
  "tool_progress": ["tool.delta"],
  "auth_status": ["permission.requested"],
  "task_notification": ["todo.updated"],
  "task_started": ["todo.updated"],
  "task_progress": ["todo.updated"],
  "files_persisted": ["file.changed"],
  "tool_use_summary": ["usage.updated"],
  "rate_limit": ["usage.updated"],
};

function buildActionTable(actions: { id: string; provider: string; scope: string; streaming: boolean; sideEffects: boolean }[]): string {
  const rows = actions.map(
    (a) => `| \`${a.id}\` | ${a.scope} | ${a.streaming ? "Yes" : "No"} | ${a.sideEffects ? "Yes" : "No"} |`
  );
  return `| Action ID | Scope | Streaming | Side Effects |\n| --- | --- | --- | --- |\n${rows.join("\n")}`;
}

function buildEventTable(mapping: Record<string, string[]>): string {
  const rows = Object.entries(mapping).map(
    ([raw, normalized]) => `| \`${raw}\` | ${normalized.map((n) => `\`${n}\``).join(", ")} |`
  );
  return `| Raw Event | Normalized Events |\n| --- | --- |\n${rows.join("\n")}`;
}

export function generateCoverageContent(): string {
  const sections: string[] = [];

  sections.push("# SDK Coverage Matrix");
  sections.push("");
  sections.push("Auto-generated from the action registry and event normalizers.");
  sections.push("");
  sections.push("## Packages");
  sections.push("");
  sections.push("| Provider | Package |");
  sections.push("| --- | --- |");
  sections.push("| OpenCode | `@opencode-ai/sdk` |");
  sections.push("| Codex | `@openai/codex-sdk` |");
  sections.push("| Claude | `@anthropic-ai/claude-agent-sdk` |");
  sections.push("");

  sections.push("## OpenCode Actions");
  sections.push("");
  sections.push(buildActionTable(opencodeActions));
  sections.push("");

  sections.push("## Codex Actions");
  sections.push("");
  sections.push(buildActionTable(codexActions));
  sections.push("");

  sections.push("## Claude Actions");
  sections.push("");
  sections.push(buildActionTable(claudeActions));
  sections.push("");

  sections.push("## OpenCode Event Mapping");
  sections.push("");
  sections.push(buildEventTable(opencodeEventMapping));
  sections.push("");

  sections.push("## Codex Event Mapping");
  sections.push("");
  sections.push(buildEventTable(codexEventMapping));
  sections.push("");

  sections.push("## Claude Event Mapping");
  sections.push("");
  sections.push(buildEventTable(claudeEventMapping));
  sections.push("");

  sections.push("## Permission Mapping");
  sections.push("");
  sections.push("| Provider | `normal` | `yolo` |");
  sections.push("| --- | --- | --- |");
  sections.push("| OpenCode | Asks when tools need approval via permission rules | Allows requested tools where supported |");
  sections.push("| Codex | `approvalPolicy: \"on-request\"` + safe sandbox mode | `approvalPolicy: \"never\"` + `sandboxMode: \"danger-full-access\"` |");
  sections.push("| Claude | `permissionMode: \"default\"` + `canUseTool` | `permissionMode: \"bypassPermissions\"` |");
  sections.push("");

  sections.push("## Limitations");
  sections.push("");
  sections.push("- The daemon does not persist runs to a database in v1.");
  sections.push("- OpenCode TUI actions (`tui.*`) control UI state, not daemon execution.");
  sections.push("- Codex SDK currently lacks a first-class daemon permission callback equivalent to Claude `canUseTool`.");
  sections.push("- Claude `hook_started` events without `PermissionRequest` are normalized as `tool.started`.");
  sections.push("- Unknown provider events are preserved as `provider.raw` and normalized as `unknown`.");
  sections.push("");

  sections.push("## Real SDK Smoke Test Environment");
  sections.push("");
  sections.push("To run real SDK integration tests, set the following environment variables:");
  sections.push("");
  sections.push("| Variable | Required For |");
  sections.push("| --- | --- |");
  sections.push("| `RUN_REAL_SDK_TESTS=1` | All providers (opt-in) |");
  sections.push("| `ANTHROPIC_API_KEY` | Claude |");
  sections.push("| `OPENAI_API_KEY` | Codex |");
  sections.push("| `CODEX_API_KEY` | Codex (alternative) |");
  sections.push("| `OPENCODE_DAEMON_REAL_TEST=1` | OpenCode |");
  sections.push("");
  sections.push("Provider CLI auth is preferred over API keys. Set up each provider through its own CLI:");
  sections.push("");
  sections.push("- `claude` — login/configure Claude Code");
  sections.push("- `codex --login` — login/configure Codex CLI");
  sections.push("- `opencode` — connect or configure providers/local models");
  sections.push("");

  return sections.join("\n");
}

async function main(): Promise<void> {
  const md = generateCoverageContent();
  const outPath = resolve(import.meta.dirname, "..", "docs", "daemon", "sdk-coverage.md");
  await writeFile(outPath, md, "utf-8");
  console.log(`Wrote SDK coverage to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
