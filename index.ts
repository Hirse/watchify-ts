import { BrowserifyObject, CustomOptions } from "browserify";
import { FSWatcher, watch, WatchOptions } from "chokidar";
import { join } from "path";
import * as picomatch from "picomatch";
import * as through from "through2";

declare module "browserify" {
  interface BrowserifyObject {
    _expose: {
      [id: number]: string;
    };
    _options: WatchifyBrowserifyOptions;
    _watcher: (file: string, opts: WatchOptions) => FSWatcher;
    close: () => void;
    on(event: "update", listener: (ids: string[]) => void): this;
    on(event: "bytes", listener: (bytes: number) => void): this;
    on(event: "time", listener: (time: number) => void): this;
    on(event: "log", listener: (message: string) => void): this;
  }
}

export interface WatchifyBrowserifyOptions {
  cache: {
    [file: string]: {
      source: string;
      deps: unknown;
    };
  };
  packageCache: {
    [file: string]: unknown;
  };
}

export interface WatchifyOptions extends CustomOptions {
  delay?: number;
  ignoreWatch?: string | string[];
  poll?: boolean | number;
}

export function watchify(
  b: BrowserifyObject,
  options: WatchifyOptions = {}
): BrowserifyObject {
  const cache = b._options.cache;
  const packageCache = b._options.packageCache;

  const delay = typeof options.delay === "number" ? options.delay : 100;
  const ignoreMatcher = picomatch(options.ignoreWatch || "**/node_modules/**");
  const wopts: WatchOptions = { persistent: true };
  if (typeof options.poll === "boolean") {
    wopts.usePolling = options.poll;
  } else if (typeof options.poll === "number") {
    wopts.usePolling = true;
    wopts.interval = options.poll;
  }

  let pendingTimeout: NodeJS.Timeout | undefined;
  let updating = false;
  const changingDeps: Map<string, boolean> = new Map();
  const fwatchers: Map<string, FSWatcher[]> = new Map();
  const fwatcherFiles: Map<string, Set<string>> = new Map();
  const ignoredFiles: Map<string, boolean> = new Map();

  const collect = (): void => {
    b.pipeline.get("deps").push(
      through.obj(function (row, _, next) {
        const file = row.expose ? b._expose[row.id] : row.file;
        cache[file] = {
          source: row.source,
          deps: Object.assign({}, row.deps),
        };
        this.push(row);
        next();
      })
    );
  };

  const invalidate = (id: string): void => {
    if (cache) {
      delete cache[id];
    }
    if (packageCache) {
      delete packageCache[id];
    }
    changingDeps.set(id, true);

    const watchers = fwatchers.get(id);
    if (!updating && watchers) {
      watchers.forEach((w) => {
        w.close();
      });
      fwatchers.delete(id);
      fwatcherFiles.delete(id);
    }

    // wait for the disk/editor to quiet down first:
    pendingTimeout && clearTimeout(pendingTimeout);
    pendingTimeout = setTimeout(notify, delay);
  };

  const notify = (): void => {
    if (updating) {
      pendingTimeout = setTimeout(notify, delay);
    } else {
      pendingTimeout = undefined;
      b.emit("update", changingDeps.keys());
      changingDeps.clear();
    }
  };

  const reset = (): void => {
    let time: number;
    let bytes = 0;
    b.pipeline.get("record").on("end", () => {
      time = Date.now();
    });

    b.pipeline.get("wrap").push(
      through(
        function (chunk, enc, next) {
          bytes += chunk.length;
          this.push(chunk);
          next();
        },
        function () {
          const delta = Date.now() - time;
          b.emit("time", delta);
          b.emit("bytes", bytes);
          b.emit(
            "log",
            `${bytes} bytes written (${(delta / 1000).toFixed(2)} seconds)`
          );
          this.push(null);
        }
      )
    );
  };

  const watchFile = (file: string, dep?: string): void => {
    dep = dep || file;
    if (!ignoredFiles.has(file)) {
      ignoredFiles.set(file, ignoreMatcher(file));
    }
    if (ignoredFiles.get(file)) {
      return;
    }
    if (!fwatchers.has(file)) {
      fwatchers.set(file, []);
    }
    if (!fwatcherFiles.has(file)) {
      fwatcherFiles.set(file, new Set());
    }
    if (fwatcherFiles.get(file)?.has(dep)) {
      return;
    }

    const watcher = b._watcher(dep, wopts);
    watcher.setMaxListeners(0);
    watcher.on("error", b.emit.bind(b, "error"));
    watcher.on("change", () => {
      invalidate(file);
    });
    fwatchers.get(file)?.push(watcher);
    fwatcherFiles.get(file)?.add(dep);
  };

  if (cache) {
    b.on("reset", collect);
    collect();
  }

  b.on("file", (file) => {
    watchFile(file);
  });

  b.on("package", (pkg) => {
    const file = join(pkg.__dirname, "package.json");
    watchFile(file);
    if (packageCache) {
      packageCache[file] = pkg;
    }
  });

  b.on("reset", reset);
  reset();

  b.on("transform", (tr, mfile) => {
    tr.on("file", (dep) => {
      watchFile(mfile, dep);
    });
  });

  b.on("bundle", (bundle) => {
    updating = true;
    const onEnd = () => {
      updating = false;
    };
    bundle.on("error", onEnd);
    bundle.on("end", onEnd);
  });

  b.close = () => {
    for (const watchers of fwatchers.values()) {
      watchers.forEach((w) => {
        w.close();
      });
    }
  };

  b._watcher = (file: string, opts: WatchOptions) => {
    return watch(file, opts);
  };

  return b;
}
