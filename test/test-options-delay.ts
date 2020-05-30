import * as browserify from "browserify";
import { writeFileSync } from "fs";
import { join } from "path";
import * as test from "tape";
import { watchify } from "../dist";
import { createTempDir, getConsoleOutput } from "./util";

const tmpDir = createTempDir();

const files = {
  main: join(tmpDir, "main.js"),
  time: join(tmpDir, "time.js"),
};
writeFileSync(
  files.main,
  ['const time = require("./time");', "console.log(time);"].join("\n")
);

const testcase = (results: string[], delay?: number) => {
  return (t: test.Test) => {
    t.plan(2 + (results.length * 2));

    writeFileSync(files.time, 'module.exports = "0";');
    const b = browserify(files.main, {
      cache: {},
      packageCache: {},
    });
    b.plugin(watchify, {
      delay,
    });
    b.on("update", () => {
      b.bundle((err, src) => {
        t.ifError(err);
        t.equal(getConsoleOutput(src), results.shift());
        if (!results.length) {
          b.close();
        }
      });
    });
    b.bundle((err, src) => {
      t.ifError(err);
      t.equal(getConsoleOutput(src), "0");
      setTimeout(() => {
        writeFileSync(files.time, 'module.exports = "10";');
      }, 10);
      setTimeout(() => {
        writeFileSync(files.time, 'module.exports = "50";');
      }, 50);
      setTimeout(() => {
        writeFileSync(files.time, 'module.exports = "200";');
      }, 200);
    });
  };
};

test("options delay default", testcase(["50", "200"]));
test("options delay 0", testcase(["10", "50", "200"], 0));
test("options delay 1000", testcase(["200"], 1000));
