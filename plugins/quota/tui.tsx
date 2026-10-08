import { For, Show, createSignal, onCleanup } from "solid-js"
import { quotaDefinition } from "./rpc.ts"
import { BAR_WIDTH, quotaBar, resetLabel, type Meter } from "./meters.ts"
import { COOLDOWN_MS, POLL_MS } from "./cache.ts"

// Solarized colors match this configuration's terminal theme.
const colors = { muted: "#657b83", low: "#b58900", critical: "#dc322f" }
const quotaColor = (remaining: number) => remaining <= 20 ? colors.critical : remaining <= 50 ? colors.low : colors.muted

export default {
  id: "local.quota.cli",
  setup(context) {
    const [expanded, setExpanded] = createSignal(false)
    const releaseCommands = context.ui.slot({
      append: "app",
      render: () => {
        context.keymap.layer(() => ({
          mode: "global",
          commands: [{
            id: "local.quota.details",
            title: "Toggle quota details",
            group: "Quota",
            palette: true,
            run: () => setExpanded(!expanded()),
          }],
        }))
        return null
      },
    })
    const releaseSidebar = context.ui.slot({
      append: "sidebar.content",
      render: () => {
        const [meters, setMeters] = createSignal<Meter[]>([])
        const [error, setError] = createSignal(false)
        const [now, setNow] = createSignal(Date.now())
        // Use one stable server location across projects and tabs.
        const location = context.data.location.default()
        const rpc = context.client.rpc(quotaDefinition)
        let disposed = false
        let generation = 0
        let pending = false
        let trailing: ReturnType<typeof setTimeout> | undefined
        const refresh = async (force = false) => {
          if (disposed) return
          if (pending) { if (force) schedule(); return }
          pending = true
          const version = generation
          try {
            const result = await rpc.read({ refresh: force }, { location }) as { meters: Meter[] }
            if (!disposed && generation === version) { setMeters(result.meters); setError(false) }
          } catch { if (!disposed && generation === version) setError(true) }
          finally { pending = false }
        }
        const schedule = () => {
          if (trailing) return
          trailing = setTimeout(() => { trailing = undefined; void refresh(true) }, COOLDOWN_MS + 1000)
        }
        const stop = context.data.listen(({ details }) => {
          if (/^session\.execution\.(succeeded|failed|interrupted|cancelled)$/.test(details.type)) schedule()
          if (details.type.startsWith("credential.")) { generation++; setMeters([]); schedule() }
        })
        void refresh()
        const timer = setInterval(() => { setNow(Date.now()); void refresh() }, 60_000)
        onCleanup(() => { disposed = true; stop(); clearInterval(timer); clearTimeout(trailing) })
        return (
          <box flexDirection="column" marginTop={1}>
            <text fg={colors.muted} onMouseDown={() => setExpanded(!expanded())}>
              {expanded() ? "▾" : "▸"} Quota left
            </text>
            <Show when={error()}><text fg={colors.muted}>Quota service unavailable</text></Show>
            <Show when={!meters().length && !error()}><text fg={colors.muted}>Loading quotas…</text></Show>
            <For each={meters()}>{(meter) => (
              <box flexDirection="column">
                <box flexDirection="row" flexWrap="wrap" columnGap={1}>
                  <text fg={colors.muted}>{meter.provider.padEnd(6)}</text>
                  <For each={meter.windows}>{(window) => (
                    <text fg={colors.muted}>
                      {window.label === "5h" ? "5" : window.label}▕<span style={{ fg: quotaColor(window.remaining) }}>{quotaBar(window.remaining).slice(1, BAR_WIDTH + 1)}</span>{quotaBar(window.remaining).slice(BAR_WIDTH + 1)}
                    </text>
                  )}</For>
                  <Show when={!expanded() && meter.windows.length === 1}>
                    <text fg={colors.muted}>· {resetLabel(meter.windows[0].reset, now())}</text>
                  </Show>
                </box>
                <Show when={meter.updated > 0 && (error() || meter.error || now() - meter.updated > POLL_MS + 60_000)}>
                  <text fg={colors.muted}>Stale · last checked {resetLabel(now(), meter.updated)} ago</text>
                </Show>
                <Show when={meter.error}><text fg={colors.muted}>{meter.error}</text></Show>
                <Show when={!meter.windows.length && !meter.error}><text fg={colors.muted}>No quota windows reported</text></Show>
                <For each={meter.windows.filter((window) => expanded() || window.remaining <= 20)}>{(window) => (
                  <text fg={colors.muted}>
                    {window.label} {Math.round(window.remaining)}% · {resetLabel(window.reset, now())}
                  </text>
                )}</For>
              </box>
            )}</For>
          </box>
        )
      },
    })
    return () => { releaseSidebar(); releaseCommands() }
  },
}
