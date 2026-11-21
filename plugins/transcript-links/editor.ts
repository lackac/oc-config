import { execFile } from "node:child_process"
import { stat } from "node:fs/promises"
import { join } from "node:path"
import { promisify } from "node:util"
import type { FileLink } from "./links.ts"

const exec = promisify(execFile)
type Run = (command: string, args: string[], timeout?: number) => Promise<string>
const run: Run = async (command, args, timeout = 4000) => {
  try {
    return (await exec(command, args, { timeout })).stdout.trimEnd()
  } catch (error) {
    const failure = error as Error & { stderr?: string; killed?: boolean }
    throw new Error(failure.stderr?.trim() || (failure.killed ? `${command} timed out` : failure.message))
  }
}

type Editor = { socket: string; pane: string }

const vimString = (text: string) => `'${text.replaceAll("'", "''")}'`

async function remoteEdit(run: Run, editor: Editor, { file, line, column }: FileLink) {
  // Pass the filename as data to structured :edit, not as keys or an Ex command.
  const lua = [
    "local file,line,col,pane=unpack(_A)",
    'if vim.env.TMUX_PANE~=pane and vim.env.REX_BLOCK~=pane then error("Editor pane changed") end',
    "vim.cmd.edit({args={file},magic={file=false,bar=false}})",
    "if line>0 then vim.fn.cursor(line,col) end",
    "return 1",
  ].join("; ")
  const expr = `luaeval(${vimString(`(function() ${lua} end)()`)}, [${vimString(file)}, ${line ?? 0}, ${column ?? 1}, ${vimString(editor.pane)}])`
  if ((await run("nvim", ["--server", editor.socket, "--remote-expr", expr])) !== "1") {
    throw new Error("Neovim did not confirm that it opened the file")
  }
}

const tmuxPane = /^%\d+$/
const rexBlock = /^block:[\da-f-]+$/i
const isSocket = async (path: string) => (await stat(path).catch(() => undefined))?.isSocket() === true

async function openTmux(
  link: FileLink, directory: string, origin: string, socket: string, session: string,
  run: Run, socketExists: typeof isSocket,
) {
  const tmux = (args: string[], timeout?: number) => run("tmux", ["-S", socket, ...args], timeout)
  const window = await tmux(["display-message", "-p", "-t", origin, "#{window_id}"])
  if (!/^@\d+$/.test(window)) throw new Error("Could not find the OpenCode tmux window")
  const panes = await tmux(["list-panes", "-t", window, "-F", "#{pane_id}\t#{pane_dead}\t#{@opencode-editor}"])
  const editors: Editor[] = []
  for (const entry of panes.split("\n")) {
    const [pane, dead, socket] = entry.split("\t")
    if (pane !== origin && tmuxPane.test(pane) && dead === "0" && socket?.startsWith("/") && await socketExists(socket)) {
      editors.push({ pane, socket })
    }
  }
  if (editors.length === 1) {
    await remoteEdit(run, editors[0], link)
    await tmux(["select-pane", "-t", editors[0].pane])
    return
  }
  const clients = await tmux(["list-clients", "-F", "#{session_id}\t#{window_id}\t#{client_activity}\t#{client_name}"])
  const client = clients.split("\n").map((row) => row.split("\t"))
    .filter(([sid, wid, , name]) => sid === session && wid === window && name)
    .sort((a, b) => Number(b[2]) - Number(a[2]))[0]?.[3]
  if (!client) throw new Error("No attached tmux client is showing the OpenCode pane")
  const position = link.line ? [`+call cursor(${link.line},${link.column ?? 1})`] : []
  // A popup is not a pane. Don't let Neovim's navigation plugins target its parent pane.
  // tmux expands formats in -d; multiple command arguments bypass the shell.
  await tmux(["display-popup", "-c", client, "-t", origin, "-E", "-w", "80%", "-h", "80%",
    "-d", directory.replaceAll("#", "##"), "env", "-u", "TMUX", "-u", "TMUX_PANE", "-u", "REX_SESSION",
    "-u", "REX_BLOCK", "nvim", ...position, "--", link.file], 0)
}

export function createOpener(env = process.env, runCommand = run, socketExists = isSocket) {
  return async (link: FileLink, directory: string) => {
    const tmux = /^(.*),\d+,(\d+)$/.exec(env.TMUX ?? "")
    if (tmux?.[1] && tmuxPane.test(env.TMUX_PANE ?? "")) {
      return openTmux(link, directory, env.TMUX_PANE!, tmux[1], `$${tmux[2]}`, runCommand, socketExists)
    }
    const { REX_SESSION: session, REX_BLOCK: origin, REX_SERVER: endpoint, REX_BIN_DIR: bin } = env
    if (!session || !/^session:[\da-f-]+$/i.test(session) || !origin || !rexBlock.test(origin)) {
      throw new Error("OpenCode is not running in tmux or Rex")
    }
    if (endpoint && !endpoint.startsWith("unix:///")) throw new Error("Opening files requires a local Rex server")
    const rex = (args: string[]) => runCommand(bin ? join(bin, "rex") : "rex",
      ["--autostart=false", ...(endpoint ? ["-S", endpoint] : []), ...args])
    const result = JSON.parse(await rex(["do", "transcript_editor", "-s", session, "-b", origin, "--json", "--args",
      JSON.stringify({ directory, file: link.file, line: link.line, column: link.column })]))
    if (result?.floating === true) return
    if (!rexBlock.test(result?.pane) || typeof result?.socket !== "string" || !result.socket.startsWith("/")) {
      throw new Error("Rex did not return a valid editor pane")
    }
    await remoteEdit(runCommand, result, link)
    await rex(["focus", "-s", session, result.pane])
  }
}

export function openBrowser(url: string, runCommand = run) {
  return runCommand(process.platform === "darwin" ? "/usr/bin/open" : "xdg-open", [url])
}
