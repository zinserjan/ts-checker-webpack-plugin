# ts-checker-webpack-plugin
> Webpack plugin that type checks & lints your TypeScript files blazingly fast.

[![Build Status Linux & macOS][build-travis-badge]][build-travis] [![Build Status Windows][build-appveyor-badge]][build-appveyor] [![codecov][codecov-badge]][codecov]

## Installation

Install ts-checker-webpack-plugin via NPM as usual:

```sh
$ npm install ts-checker-webpack-plugin --save-dev
```

Note: This plugin requires TypeScript 2 and optionally TSLint 5

And configure it in your webpack config like below (assumes webpack-config at project root):

```js
const path = require("path");
const TsCheckerWebpackPlugin = require("ts-checker-webpack-plugin");

module.exports = {
  entry: "./src/index.ts",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        options: {
          transpileOnly: true, // disable type checker - we will use ts-checker-webpack-plugin for that :)
        }
      },
      {
        test: /\.css$/,
        exclude: /\.module\.css$/,
        use: [
          "style-loader",
          "css-loader",
        ],
      },
      {
        test: /\.module\.css$/,
        use: [
          "style-loader",
          {
            loader: "typings-for-css-modules-loader",
            options: {
              modules: true,
              namedExport: true,
              camelCase: true,
            },
          },
        }
      ],
    ]
  },
  plugins: [
    new TsCheckerWebpackPlugin({
      tsconfig: path.resolve("tsconfig.json"),
      tslint: path.resolve("tslint.json"), // optional
      memoryLimit: 512, // optional, maximum memory usage in MB
      diagnosticFormatter: "ts-loader", // optional, one of "ts-loader", "stylish", "codeframe"
    })
  ]
};
```

## Options

```js
new TsCheckerWebpackPlugin(options: object)
```

|Name|Type|Description|
|:--|:--:|:----------|
|**`tsconfig`**|`string`|Absolute path to tsconfig.json file.|
|**`tslint`**|`string`|Absolute path to tslint.json file. <br>Default: `undefined`|
|**`tslintEmitErrors`**|`boolean`|Report all TSLint failures as webpack errors regardless of the rule severity. <br>Default: `false`|
|**`memoryLimit`**|`number`|Memory limit for the type checker process in MB. <br>Default: `512`|
|**`diagnosticFormatter`**|`string`|Formatter for TypeScript Diagnostics. <br>One of `ts-loader`, `stylish` or `codeframe`.<br> Default: `ts-loader`|
|**`timings`**|`boolean`|Logs timing information of the type checker. <br>Default: `false`|
|**`ignoreDiagnostics`**|`number[]`|List of TypeScript diagnostic codes to ignore. <br>Default: `[]`|
|**`ignoreLints`**|`string[]`|List of TSLint rule names to ignore. <br>Default: `[]`|


## Motivation

First off all the approach is based on the idea of [fork-ts-checker-webpack-plugin](https://github.com/Realytics/fork-ts-checker-webpack-plugin) to run the type checking process independently of the actual transpiling of the files with [ts-loader](https://github.com/TypeStrong/ts-loader) to speed things up.
But the main motivation for this plugin was to support CSS-Modules with type definitions properly without using any workarounds ([1](https://github.com/Jimdo/typings-for-css-modules-loader/issues/33#issuecomment-303330819), [2](https://github.com/Quramy/typed-css-modules/issues/2#issuecomment-260391196)).

Differences to fork-ts-checker-webpack-plugin
- support of typed CSS-Modules with [typings-for-css-modules-loader](https://github.com/Jimdo/typings-for-css-modules-loader)
- works well with create-react-app in watch mode cause type checking errors will be forwarded to webpack
- files are cached internally until they will be invalidated by webpack

## Performance tips
You can improve the type checking performance even more with some tweaks in your `tsconfig.json`.

### Skip type checking of all declaration files

You can skip type checking of all declaration files with `skipLibCheck: true`. See [TypeScript Compiler Options](https://www.typescriptlang.org/docs/handbook/compiler-options.html).

### Reduce files to check
This plugin processes every file that was found by your `tsconfig.json`. You can reduce the files to process by this plugin with the `files`, `includes` and/or `exclude` option in your `tsconfig.json`. See [TypeScript tsconfig.json](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html).

For example you could exclude your tests, when your test runner checks them already.  

## License

MIT


[build-travis-badge]: https://travis-ci.org/zinserjan/ts-checker-webpack-plugin.svg?branch=master
[build-travis]: https://travis-ci.org/zinserjan/ts-checker-webpack-plugin
[build-appveyor-badge]: https://ci.appveyor.com/api/projects/status/r6g3yxa1uxefswt0/branch/master?svg=true
[build-appveyor]: https://ci.appveyor.com/project/zinserjan/ts-checker-webpack-plugin
[codecov-badge]: https://codecov.io/gh/zinserjan/ts-checker-webpack-plugin/branch/master/graph/badge.svg
[codecov]: https://codecov.io/gh/zinserjan/ts-checker-webpack-plugin
