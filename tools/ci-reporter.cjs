"use strict";
const path = require("node:path");
const dataEscape = (value) =>
  String(value)
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A");
const propertyEscape = (value) =>
  dataEscape(value).replace(/:/g, "%3A").replace(/,/g, "%2C");

// Run beside the spec reporter. Node's test runner retains responsibility for
// the exit status; this reporter only adds actionable GitHub annotations.
module.exports = async function* githubAnnotations(events) {
  for await (const event of events) {
    if (event.type !== "test:fail") continue;
    const data = event.data,
      details = data.details || {};
    if (details.error?.failureType === "subtestsFailed") continue;
    let error = details.error;
    for (let depth = 0; depth < 3 && error?.cause instanceof Object; depth++)
      error = error.cause;
    const message =
      `${data.name}\n${error?.stack || error?.message || "Test failed; see browser-tests.log."}`
        .replace(/\u001b\[[0-9;]*m/g, "")
        .slice(0, 6000);
    const properties = ["title=Test failed"];
    if (data.file)
      properties.push(
        "file=" +
          propertyEscape(
            path.relative(process.cwd(), data.file).replace(/\\/g, "/"),
          ),
      );
    if (Number.isInteger(data.line) && data.line > 0)
      properties.push("line=" + data.line);
    if (Number.isInteger(data.column) && data.column > 0)
      properties.push("col=" + data.column);
    yield `::error ${properties.join(",")}::${dataEscape(message)}\n`;
  }
};
