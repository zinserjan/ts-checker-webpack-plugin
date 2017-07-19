import * as path from "path";
import TsCheckerWebpackPlugin from "../../../src/TsCheckerWebpackPlugin";

module.exports = {
  context: __dirname,
  entry: "./src/entry.ts",
  output: {
    filename: "bundle.js",
  },
  resolve: {
    // Add `.ts` and `.tsx` as a resolvable extension.
    extensions: [".ts", ".tsx", ".js"], // note if using webpack 1 you'd also need a '' in the array as well
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: "ts-loader",
          options: {
            transpileOnly: true,
          },
        },
      },
    ],
  },
  plugins: [
    new TsCheckerWebpackPlugin({
      tsconfig: path.join(__dirname, "tsconfig.json"),
    }),
  ],
};
