import * as browserify from "browserify";
import { writeFile, writeFileSync } from "fs";
import { join } from "path";
import * as test from "tape";
import { watchify } from "../dist";
import { createTempDir, getConsoleOutput } from "./util";

const tmpDir = createTempDir();
const file = join(tmpDir, "main.js");
writeFileSync(file, "console.log(555)");

test("implicit cache", (t) => {
  t.plan(5);
  const w = watchify(browserify(file));
  w.on("update", () => {
    w.bundle((err, src) => {
      t.ifError(err);
      t.equal(getConsoleOutput(src), "333");
      w.close();
    });
  });
  w.bundle((err, src) => {
    t.ifError(err);
    t.equal(getConsoleOutput(src), "555");
    setTimeout(() => {
      writeFile(file, "console.log(333)", (err) => {
        t.ifError(err);
      });
    }, 1000);
  });
});
