import webpack = require("webpack");

export default function(testCase: string, stats: webpack.Stats) {
  const statsJson = stats.toJson();

  expect(statsJson.warnings).toHaveLength(0);
  expect(statsJson.errors).toHaveLength(1);
  expect(statsJson.errors[0]).toMatch(/TS5014|TS1005/);
}
