import { actionDescriptor } from "../common/actionSchemas.js";

const p = (id: string, sideEffects = false, streaming = false) =>
  actionDescriptor(id, "codex", "provider", sideEffects, streaming);
const r = (id: string, sideEffects = false, streaming = false) =>
  actionDescriptor(id, "codex", "run", sideEffects, streaming);

export const codexActions = [
  p("thread.start"),
  r("thread.resume"),
  r("thread.run"),
  r("thread.runStreamed", false, true),
  r("turn.cancel"),
];
