import * as mkdirp from "mkdirp";
import { tmpdir } from "os";
import { join } from "path";
import { runInNewContext } from "vm";

export function getConsoleOutput(src: Buffer): string {
  let output = "";
  runInNewContext(src.toString(), {
    console: {
      log: (message: string) => {
        output += message;
      },
    },
  });
  return output;
}

export function createTempDir(): string {
  const tmpDir = join(tmpdir(), "watchify-" + Math.random());
  mkdirp.sync(tmpDir);
  return tmpDir;
}
