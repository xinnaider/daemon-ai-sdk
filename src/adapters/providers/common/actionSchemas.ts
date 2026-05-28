import { z } from "zod";
import type { SdkActionDescriptor } from "../../../domain/providers.js";

export function actionDescriptor(
  id: string,
  provider: string,
  scope: string,
  sideEffects: boolean,
  streaming: boolean
): SdkActionDescriptor {
  return {
    id,
    provider,
    scope,
    description: "",
    inputSchema: z.object({}) as unknown as Record<string, unknown>,
    outputSchema: z.object({}) as unknown as Record<string, unknown>,
    streaming,
    sideEffects,
  };
}
