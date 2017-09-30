import webpack = require("webpack");

export function expectBuildError(error: Error) {
  expect(error.message).toMatch("Failed to parse file");
}
