import * as browserify from "browserify";
import { writeFileSync } from "fs";
import * as mkdirp from "mkdirp";
import { dirname, join } from "path";
import * as test from "tape";
import { watchify } from "../dist";
import { createTempDir, getConsoleOutput } from "./util";

const tmpDir = createTempDir();

const files = {
  main: join(tmpDir, "main.js"),
  beep: join(tmpDir, "beep.js"),
  boop: join(tmpDir, "boop.js"),
  robot: join(tmpDir, "node_modules", "robot", "index.js"),
};
writeFileSync(
  files.main,
  [
    'const beep = require("./beep");',
    'const boop = require("./boop");',
    'const robot = require("robot");',
    'console.log(beep + " " + boop + " " + robot);',
  ].join("\n")
);
mkdirp.sync(dirname(files.robot));

const testcase = (result: string, ignoreWatch?: string | string[]) => {
  return (t: test.Test) => {
    t.plan(4);

    writeFileSync(files.beep, 'module.exports = "beep";');
    writeFileSync(files.boop, 'module.exports = "boop";');
    writeFileSync(files.robot, 'module.exports = "robot";');
    const b = browserify(files.main, {
      cache: {},
      packageCache: {},
    });
    b.plugin(watchify, {
      ignoreWatch,
    });
    b.on("update", () => {
      b.bundle((err, src) => {
        t.ifError(err);
        t.equal(getConsoleOutput(src), result);
        b.close();
      });
    });
    b.bundle((err, src) => {
      t.ifError(err);
      t.equal(getConsoleOutput(src), "beep boop robot");
      setTimeout(() => {
        writeFileSync(files.beep, 'module.exports = "BEEP";');
        writeFileSync(files.boop, 'module.exports = "BOOP";');
        writeFileSync(files.robot, 'module.exports = "ROBOT";');
      }, 1000);
    });
  };
};

test("options ignoreWatch default", testcase("BEEP BOOP robot"));
test("options ignoreWatch single", testcase("beep BOOP ROBOT", "**/beep.js"));
test(
  "options ignoreWatch multiple",
  testcase("beep BOOP robot", ["**/beep.js", "**/robot/*.js"])
);
