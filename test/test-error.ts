import * as browserify from "browserify";
import { writeFileSync } from "fs";
import { join } from "path";
import * as test from "tape";
import { watchify } from "../dist";
import { createTempDir, getConsoleOutput } from "./util";

const tmpDir = createTempDir();
const file = join(tmpDir, "main.js");
writeFileSync(file, "console.log(555)");

test("error", (t) => {
  t.plan(5);
  const b = browserify(file, {
    plugin: [watchify],
    cache: {},
    packageCache: {},
  });
  b.bundle((err, src) => {
    t.ifError(err);
    t.equal(getConsoleOutput(src), "555");

    setTimeout(() => {
      writeFileSync(file, "console.log(");
    }, 100);
    b.once("update", () => {
      b.bundle((err) => {
        t.ok(err instanceof Error, "should be error");

        setTimeout(() => {
          writeFileSync(file, "console.log(333)");
        }, 100);
        b.once("update", () => {
          b.bundle((err, src) => {
            t.ifError(err);
            t.equal(getConsoleOutput(src), "333");
            b.close();
          });
        });
      });
    });
  });
});
