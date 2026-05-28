import { actionDescriptor } from "../common/actionSchemas.js";

const p = (id: string, sideEffects = false, streaming = false) =>
  actionDescriptor(id, "claude", "provider", sideEffects, streaming);
const r = (id: string, sideEffects = false, streaming = false) =>
  actionDescriptor(id, "claude", "run", sideEffects, streaming);

export const claudeActions = [
  r("query.run", false, true),
  p("tool.create"),
  p("mcp.createSdkMcpServer"),
  p("sessions.list"),
  p("sessions.messages"),
  p("sessions.info"),
  p("sessions.rename"),
  p("sessions.tag"),
  r("query.interrupt"),
  r("query.close"),
  r("query.initializationResult"),
  r("query.supportedCommands"),
  r("query.supportedModels"),
  r("query.supportedAgents"),
  r("query.accountInfo"),
  r("query.rewindFiles"),
  r("query.setPermissionMode"),
  r("query.setModel"),
  r("query.setMaxThinkingTokens"),
  r("query.mcpServerStatus"),
  r("query.reconnectMcpServer"),
  r("query.toggleMcpServer"),
  r("query.setMcpServers"),
  r("query.streamInput"),
  r("query.stopTask"),
];
