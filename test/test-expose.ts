import * as browserify from "browserify";
import { writeFileSync } from "fs";
import * as mkdirp from "mkdirp";
import { join } from "path";
import * as test from "tape";
import { watchify, WatchifyBrowserifyOptions } from "../dist";
import { createTempDir, getConsoleOutput } from "./util";

const tmpDir = createTempDir();

const files = {
  main: join(tmpDir, "main.js"),
  beep: join(tmpDir, "beep.js"),
  boop: join(tmpDir, "boop.js"),
  abc: join(tmpDir, "lib", "abc.js"),
  xyz: join(tmpDir, "lib", "xyz.js"),
};

mkdirp.sync(join(tmpDir, "lib"));

writeFileSync(
  files.main,
  [
    'var abc = require("abc");',
    'var xyz = require("xyz");',
    'var beep = require("./beep");',
    'console.log(abc + " " + xyz + " " + beep);',
  ].join("\n")
);
writeFileSync(files.beep, 'module.exports = require("./boop");');
writeFileSync(files.boop, 'module.exports = require("xyz");');
writeFileSync(files.abc, 'module.exports = "abc";');
writeFileSync(files.xyz, 'module.exports = "xyz";');

test("properly caches exposed files", (t) => {
  t.plan(4);
  const cache: WatchifyBrowserifyOptions["cache"] = {};
  const b = browserify(files.main, {
    basedir: tmpDir,
    plugin: [watchify],
    cache,
    packageCache: {},
  });
  b.require("./lib/abc", { expose: "abc" });
  b.require("./lib/xyz", { expose: "xyz" });
  b.on("update", () => {
    b.bundle((err, src) => {
      t.ifError(err);
      t.equal(getConsoleOutput(src), "ABC XYZ XYZ");
      b.close();
    });
  });
  b.bundle((err, src) => {
    t.ifError(err);
    t.equal(getConsoleOutput(src), "abc xyz xyz");
    setTimeout(() => {
      // If we're incorrectly caching exposed files,
      // then "files.abc" would be re-read from disk.
      cache[files.abc].source = 'module.exports = "ABC";';
      writeFileSync(files.xyz, 'module.exports = "XYZ";');
    }, 1000);
  });
});
