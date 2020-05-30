import * as browserify from "browserify";
import { writeFile, writeFileSync } from "fs";
import { join } from "path";
import * as test from "tape";
import { watchify } from "../dist";
import { createTempDir, getConsoleOutput } from "./util";

const tmpdir = createTempDir();

const files = {
  main: join(tmpdir, "main.js"),
  lines: join(tmpdir, "lines.txt"),
};

writeFileSync(
  files.main,
  [
    'var fs = require("fs");',
    'var src = fs.readFileSync(__dirname + "/lines.txt", "utf8");',
    "console.log(src.toUpperCase());",
  ].join("\n")
);
writeFileSync(files.lines, "beep\nboop");

test("api with brfs", (t) => {
  t.plan(5);
  const w = browserify(files.main, {
    plugin: [watchify],
    cache: {},
    packageCache: {},
  });
  w.transform("brfs");
  w.on("update", () => {
    w.bundle((err, src) => {
      t.ifError(err);
      t.equal(getConsoleOutput(src), "ROBO-BOOGIE");
      w.close();
    });
  });
  w.bundle((err, src) => {
    t.ifError(err);
    t.equal(getConsoleOutput(src), "BEEP\nBOOP");
    setTimeout(() => {
      writeFile(files.lines, "rObO-bOOgie", (err) => {
        t.ifError(err);
      });
    }, 1000);
  });
});
