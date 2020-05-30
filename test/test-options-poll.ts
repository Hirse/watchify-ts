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

const testcase = (results: string[], poll?: boolean | number) => {
  return (t: test.Test) => {
    t.plan(2 + (results.length * 2));

    writeFileSync(files.time, 'module.exports = "0";');
    const b = browserify(files.main, {
      cache: {},
      packageCache: {},
    });
    b.plugin(watchify, {
      poll,
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
        writeFileSync(files.time, 'module.exports = "50";');
      }, 50);
      setTimeout(() => {
        writeFileSync(files.time, 'module.exports = "500";');
      }, 500);
    });
  };
};

test("options poll default", testcase(["50", "500"]));
test("options poll true", testcase(["50", "500"], true));
test("options poll 1000", testcase(["500"], 1000));
