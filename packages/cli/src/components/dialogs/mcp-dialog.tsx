import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TextAttributes, type ScrollBoxRenderable, type InputRenderable } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useDialog } from "../../providers/dialog";
import { useTheme } from "../../providers/theme";
import { getMcpClient } from "../../lib/mcp/client";

const MAX_VISIBLE_ITEMS = 10;

export const McpDialogContent = () => {
  const dialog = useDialog();
  const { colors } = useTheme();
  const mcp = getMcpClient();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [, forceUpdate] = useState(0);
  const inputRef = useRef<InputRenderable>(null);
  const scrollRef = useRef<ScrollBoxRenderable>(null);

  useEffect(() => {
    return mcp.subscribe(() => forceUpdate(n => n + 1));
  }, [mcp]);

  const serverInfos = mcp.getServerInfos();

  const sorted = useMemo(() => {
    const order: Record<string, number> = {
      connected: 0,
      connecting: 1,
      disconnected: 2,
      failed: 3,
    };
    const q = query.toLowerCase();
    const filtered = !q
      ? serverInfos
      : serverInfos.filter(s => s.name.toLowerCase().includes(q));
    return [...filtered].sort(
      (a, b) => (order[a.status] ?? 99) - (order[b.status] ?? 99),
    );
  }, [serverInfos, query]);

  const handleRetry = useCallback(async (name: string) => {
    try {
      await mcp.reconnectServer(name);
    } catch {
      // status already updated via reconnectServer
    }
  }, [mcp]);

  const handleContentChange = useCallback(() => {
    setQuery(inputRef.current?.value ?? "");
    setSelectedIndex(0);
  }, []);

  useKeyboard((key) => {
    if (key.name === "up") {
      setSelectedIndex(i => Math.max(0, i - 1));
    } else if (key.name === "down") {
      setSelectedIndex(i => Math.min(sorted.length - 1, i + 1));
    } else if (key.name === "r") {
      const server = sorted[selectedIndex];
      if (server && server.status === "failed") {
        handleRetry(server.name);
      }
    } else if (key.name === "escape") {
      dialog.close();
    }
  });

  const visibleHeight = Math.min(sorted.length + 1, MAX_VISIBLE_ITEMS + 1);

  return (
    <box flexDirection="column" width={52}>

      {/* Search input */}
      <box height={1} flexDirection="row" paddingX={1}>
        <input
          ref={inputRef}
          focused
          placeholder="Filter servers..."
          onContentChange={handleContentChange}
        />
      </box>

      <box height={1} />

      {/* Server list */}
      {sorted.length === 0 ? (
        <box height={1} paddingX={1}>
          <text attributes={TextAttributes.DIM} fg="gray">No servers found</text>
        </box>
      ) : (
        <scrollbox ref={scrollRef} height={Math.min(sorted.length, MAX_VISIBLE_ITEMS)}>
          {sorted.map((info, i) => {
            const isSelected = i === selectedIndex;
            const isAvailable = info.status === "connected";

            const statusColor =
              info.status === "connected" ? "green" :
              info.status === "failed"    ? "red"   :
              info.status === "connecting" ? "yellow" : "gray";

            const statusLabel =
              info.status === "connected" ? "Available" :
              info.status === "failed"    ? "Failed"    :
              info.status === "connecting" ? "Connecting" : "Disconnected";

            return (
              <box
                key={info.name}
                height={1}
                flexDirection="row"
                paddingX={1}
                backgroundColor={isSelected ? colors.selection : undefined}
                onMouseMove={() => setSelectedIndex(i)}
              >
                {/* Name */}
                <text
                  selectable={false}
                  attributes={isSelected ? TextAttributes.BOLD : TextAttributes.NONE}
                  fg={isSelected ? "black" : "white"}
                >
                  {info.name}
                </text>

                <text selectable={false} fg={isSelected ? "black" : "gray"}> </text>

                {/* Status badge */}
                <text
                  selectable={false}
                  attributes={TextAttributes.DIM}
                  fg={isSelected ? "black" : statusColor}
                >
                  {statusLabel}
                </text>

                {/* Tool count (connected only) */}
                {isAvailable && (
                  <>
                    <text selectable={false} fg={isSelected ? "black" : "gray"}> </text>
                    <text
                      selectable={false}
                      attributes={TextAttributes.DIM}
                      fg={isSelected ? "black" : "cyan"}
                    >
                      {`${info.toolCount} tools`}
                    </text>
                  </>
                )}

                <box flexGrow={1} />

                {/* Error indicator for failed servers */}
                {info.status === "failed" && info.error && (
                  <text
                    selectable={false}
                    attributes={TextAttributes.DIM}
                    fg={isSelected ? "black" : "red"}
                  >
                    {info.error.length > 16 ? info.error.slice(0, 14) + "…" : info.error}
                  </text>
                )}

                {/* Retry hint for selected failed server */}
                {isSelected && info.status === "failed" && (
                  <>
                    <text selectable={false} fg="black">  </text>
                    <text selectable={false} attributes={TextAttributes.BOLD} fg="black">
                      [r] retry
                    </text>
                  </>
                )}

                {/* Available checkmark for connected */}
                {isAvailable && !isSelected && (
                  <text selectable={false} fg="green"> ✓</text>
                )}
              </box>
            );
          })}
        </scrollbox>
      )}

      <box height={1} />

      {/* Footer hint */}
      <box height={1} paddingX={1} flexDirection="row" gap={2}>
        <text selectable={false} attributes={TextAttributes.DIM} fg="gray">
          ↑↓ navigate
        </text>
        <text selectable={false} attributes={TextAttributes.DIM} fg="gray">
          r retry failed
        </text>
        <text selectable={false} attributes={TextAttributes.DIM} fg="gray">
          esc close
        </text>
      </box>

    </box>
  );
};
