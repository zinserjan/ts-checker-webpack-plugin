# ts-checker-webpack-plugin
> Webpack plugin that type checks & lints your TypeScript files blazingly fast.

[![Build Status Linux & macOS][build-travis-badge]][build-travis] [![Build Status Windows][build-appveyor-badge]][build-appveyor]

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
    })
  ]
};
```

## Motivation

First off all the approach is based on the idea of [fork-ts-checker-webpack-plugin](https://github.com/Realytics/fork-ts-checker-webpack-plugin) to run the type checking process independently of the actual transpiling of the files with [ts-loader](https://github.com/TypeStrong/ts-loader) to speed things up. 
But the main motivation for this plugin was to support CSS-Modules with type definitions properly without using any workarounds ([1](https://github.com/Jimdo/typings-for-css-modules-loader/issues/33#issuecomment-303330819), [2](https://github.com/Quramy/typed-css-modules/issues/2#issuecomment-260391196)).

Differences to fork-ts-checker-webpack-plugin
- support of typed CSS-Modules with [typings-for-css-modules-loader](https://github.com/Jimdo/typings-for-css-modules-loader)
- works well with create-react-app in watch mode cause type checking errors will be forwarded to webpack
- checks only files processed by webpack
- files are cached internally until they will be invalidated by webpack


## License

MIT


[build-travis-badge]: https://travis-ci.org/zinserjan/ts-checker-webpack-plugin.svg?branch=master
[build-travis]: https://travis-ci.org/zinserjan/ts-checker-webpack-plugin
[build-appveyor-badge]: https://ci.appveyor.com/api/projects/status/r6g3yxa1uxefswt0/branch/master?svg=true
[build-appveyor]: https://ci.appveyor.com/project/zinserjan/ts-checker-webpack-plugin

