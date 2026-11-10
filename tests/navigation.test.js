const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const appPages = ["success.html", "aboutMe.html", "forMe.html"];

test("the SpotiCustom brand returns to the server home route", async () => {
  for (const page of appPages) {
    const html = await readFile(path.join(__dirname, "..", page), "utf8");
    assert.match(
      html,
      /<a class="brand" href="\/" aria-label="SpotiCustom home">/,
      `${page} must link the SpotiCustom brand to /`
    );
  }
});
