import { execFile as nodeExecFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(nodeExecFile);

export type ExecFileFn = (file: string, args: string[]) => Promise<{ stdout: string }>;

export async function detectCli(
  binary: string,
  execFile: ExecFileFn = execFileAsync
): Promise<{ available: boolean; path: string | null }> {
  const isWindows = process.platform === "win32";
  const cmd = isWindows ? "where.exe" : "which";

  try {
    const { stdout } = await execFile(cmd, [binary]);
    const path = stdout.trim().split("\n")[0]?.trim() ?? null;
    return { available: path !== null, path };
  } catch {
    return { available: false, path: null };
  }
}
