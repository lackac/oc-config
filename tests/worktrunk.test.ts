import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { realpathSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import worktrunk from "../plugins/worktrunk/index.ts"

test("Worktrunk loads in the running OpenCode server", () => {
  const directory = realpathSync(fileURLToPath(new URL("..", import.meta.url)))
  const query = new URLSearchParams({ "location[directory]": directory })
  const { data } = JSON.parse(execFileSync("opencode", ["api", "get", `/api/plugin?${query}`], {
    encoding: "utf8",
    timeout: 30_000,
  }))
  const plugin = data.find((item) =>
    item.id === "worktrunk" || item.source?.path?.includes("/plugins/worktrunk"))

  assert.ok(plugin, "Worktrunk plugin was not discovered")
  assert.equal(plugin.state.status, "active", JSON.stringify(plugin.state))
  assert.equal(plugin.id, "worktrunk")
  const pluginDirectory = realpathSync(fileURLToPath(new URL("../plugins/worktrunk", import.meta.url)))
  assert.ok([pluginDirectory, `${pluginDirectory}/index.ts`].includes(realpathSync(plugin.source.path)),
    "OpenCode must load this checkout's Worktrunk plugin directory or entrypoint")
})

test("Worktrunk registers a native OpenCode worktree strategy", async () => {
  let strategy
  await worktrunk.setup({
    worktree: {
      async transform(callback) {
        callback({ add(value) { strategy = value } })
      },
    },
  })

  assert.equal(strategy?.id, "worktrunk")
  for (const operation of ["create", "remove", "list"]) {
    assert.equal(typeof strategy[operation], "function")
  }
})
