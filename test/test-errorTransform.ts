import * as browserify from "browserify";
import { writeFileSync } from "fs";
import { join } from "path";
import * as test from "tape";
import * as through from "through2";
import { watchify } from "../dist";
import { createTempDir, getConsoleOutput } from "./util";

const tmpDir = createTempDir();
const main = join(tmpDir, "main.js");
const file = join(tmpDir, "dep.js");
writeFileSync(main, 'require("./dep.js");');
writeFileSync(file, "console.log(555);");

function someTransform(file: string) {
  if (file.endsWith("dep.js")) {
    return through(function (chunk, _, next) {
      if (/\d/.test(chunk)) {
        this.push(chunk);
      } else {
        this.emit("error", new Error("No number in this chunk"));
      }
      next();
    });
  }
  return through();
}

test("errors in transform", (t) => {
  t.plan(6);
  const b = browserify(main, {
    plugin: [watchify],
    cache: {},
    packageCache: {},
  });
  b.transform(someTransform);
  b.bundle((err, src) => {
    t.ifError(err);
    t.equal(getConsoleOutput(src), "555");

    setTimeout(() => {
      writeFileSync(file, "console.log()");
    }, 100);
    b.once("update", () => {
      b.bundle((err) => {
        t.ok(err instanceof Error, "should be error");
        t.ok(/^No number in this chunk/.test(err.message));

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
