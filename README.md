![npm](https://img.shields.io/npm/v/watchify-ts)
![node-current](https://img.shields.io/node/v/watchify-ts)
![build](https://github.com/Hirse/watchify-ts/workflows/build/badge.svg)

# watchify-ts

watch for [browserify](https://github.com/substack/node-browserify) builds

Update any source file and your browserify bundle will be recompiled on the
spot.

## Install

With [npm](https://npmjs.org) do:

```
$ npm install --save-dev watchify-ts
```

## Usage

```js
const { watchify } = require("watchify-ts");
```

watchify is a browserify [plugin](https://github.com/browserify/browserify#bpluginplugin-opts), so it can be applied like any other plugin.
However, when creating the browserify instance `b`, **you MUST set the `cache`
and `packageCache` properties**:

```js
const b = browserify({
  cache: {},
  packageCache: {},
});
b.plugin(watchify);
```

```js
const b = browserify({
  plugin: [watchify],
  cache: {},
  packageCache: {},
});
```

**By default, watchify doesn't display any output, see [events](https://github.com/browserify/watchify#events) for more info.**

`b` continues to behave like a browserify instance except that it caches file
contents and emits an `"update"` event when a file changes. You should call
`b.bundle()` after the `"update"` event fires to generate a new bundle.
Calling `b.bundle()` extra times past the first time will be much faster due
to caching.

**Important:** Watchify will not emit `"update"` events until you've called
`b.bundle()` once and completely drained the stream it returns.

```js
const browserify = require("browserify");
const { createWriteStream } = require("fs");
const { watchify } = require("watchify-ts");

const b = browserify("path/to/entry.js", {
  plugin: [watchify],
  cache: {},
  packageCache: {},
});

const bundle = () => {
  b.bundle().on("error", console.error).pipe(createWriteStream("output.js"));
};

b.on("update", bundle);
bundle();
```

## Options

You can to pass an additional options object as a second parameter of
watchify. Its properties are:

`opts.delay` is the amount of time in milliseconds to wait before emitting
an "update" event after a change. Defaults to `100`.

`opts.ignoreWatch` is one or more glob patterns to ignore monitoring files for changes.
Defaults to `**/node_modules/**`.

`opts.poll` enables polling to monitor for changes. If set to `true`, then
a polling interval of 100ms is used. If set to a number, then that amount of
milliseconds will be the polling interval. For more info see Chokidar's
[documentation](https://github.com/paulmillr/chokidar#performance) on
"usePolling" and "interval".
**This option is useful if you're watching an NFS volume.**

```js
const b = browserify({
  cache: {},
  packageCache: {}
});
// watchify defaults:
b.plugin(watchify, {
  delay: 100,
  ignoreWatch: "**/node_modules/**",
  poll: undefined, // Use chokidar default
});
```

### `b.close()`

Close all the open watch handles.

## Events

### b.on("update", (ids) => {})

When the bundle changes, emit the array of bundle `ids` that changed.

### b.on("bytes", (bytes) => {})

When a bundle is generated, this event fires with the number of bytes.

### b.on("time", (time) => {})

When a bundle is generated, this event fires with the time it took to create the
bundle in milliseconds.

### b.on("log", (message) => {})

This event fires after a bundle was created with messages of the form:

```
X bytes written (Y seconds)
```

with the number of bytes in the bundle X and the time in seconds Y.

## Working With Browserify Transforms

If your custom transform for browserify adds new files to the bundle in a non-standard way without requiring.
You can inform Watchify about these files by emiting a 'file' event.

```js
module.exports = (file) => {
  return through(function (buf, enc, next) {
    // manipulating file content
    this.emit("file", absolutePathToFileThatHasToBeWatched);
    next();
  });
};
```

## Troubleshooting

### Rebuilds on OS X never trigger

It may be related to a bug in `fsevents` (see [#250](https://github.com/browserify/watchify/issues/205#issuecomment-98672850)
and [stackoverflow](http://stackoverflow.com/questions/26708205/webpack-watch-isnt-compiling-changed-files/28610124#28610124)).
Try the `poll` option and/or renaming the project's directory - that might help.

### Watchify Swallows Errors

To ensure errors are reported you have to add a event listener to your bundle stream. For more information see ([browserify/browserify#1487 (comment)](https://github.com/browserify/browserify/issues/1487#issuecomment-173357516) and [stackoverflow](https://stackoverflow.com/a/22389498/1423220))

**Example:**

```js
var b = browserify();
b.bundle().on("error", console.error);
```

## See Also

- [budo](https://www.npmjs.com/package/budo) – a simple development server built on watchify
- [errorify](https://www.npmjs.com/package/errorify) – a plugin to add error handling to watchify development
- [watchify-request](https://www.npmjs.com/package/watchify-request) – wraps a `watchify` instance to avoid stale bundles in HTTP requests
- [watchify-middleware](https://www.npmjs.com/package/watchify-middleware) – similar to `watchify-request`, but includes some higher-level features
