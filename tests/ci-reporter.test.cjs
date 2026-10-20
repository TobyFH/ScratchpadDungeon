const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");
const reporter = require("../tools/ci-reporter.cjs");

test("CI annotations escape workflow commands, identify the test and suppress aggregate errors", async () => {
  async function* events() {
    yield { type: "test:pass", data: { name: "pass" } };
    yield {
      type: "test:fail",
      data: {
        name: "a test\n::warning::not a command",
        file: path.join(process.cwd(), "tests/a,b.cjs"),
        line: 12,
        column: 3,
        details: { error: { cause: new Error("expected 100%\r\nnext line") } },
      },
    };
    yield {
      type: "test:fail",
      data: {
        name: "aggregate",
        details: { error: { failureType: "subtestsFailed" } },
      },
    };
  }
  let output = "";
  for await (const chunk of reporter(events())) output += chunk;
  assert.match(
    output,
    /^::error title=Test failed,file=tests\/a%2Cb.cjs,line=12,col=3::/,
  );
  assert.ok(output.includes("a test%0A::warning::not a command"));
  assert.ok(output.includes("100%25%0D%0Anext line"));
  assert.equal(output.split("\n").length, 2);
  assert.ok(!output.includes("aggregate"));
});

for (const fails of [false, true])
  test(`CI reporter preserves a ${fails ? "failing" : "passing"} test process exit status`, () => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "scratchpad-ci-reporter-"),
    );
    try {
      const fixture = path.join(dir, "probe.cjs");
      fs.writeFileSync(
        fixture,
        `require("node:test")("annotation probe",()=>{${fails ? 'throw new Error("specific failure details")' : ""}});`,
      );
      const env = { ...process.env };
      // This fixture intentionally starts an independent test runner, rather
      // than inheriting Node's marker for the current runner's child process.
      delete env.NODE_TEST_CONTEXT;
      const result = spawnSync(
        process.execPath,
        [
          "--test",
          "--test-reporter=" +
            path.resolve(__dirname, "../tools/ci-reporter.cjs"),
          fixture,
        ],
        { encoding: "utf8", env },
      );
      assert.equal(result.status, fails ? 1 : 0, result.stderr);
      if (fails) {
        assert.match(result.stdout, /::error .*::annotation probe%0A/);
        assert.match(result.stdout, /specific failure details/);
      } else assert.equal(result.stdout, "");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
