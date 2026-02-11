import { useApp } from "@modelcontextprotocol/ext-apps/react";
import { useCallback, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import mermaid from "mermaid";
import "./global.css";

// ============================================================
// Types
// ============================================================

interface DiagramState {
  mermaid: string;
  theme: string;
  title?: string;
  checkpointId?: string;
}

interface PanZoomState {
  scale: number;
  translateX: number;
  translateY: number;
}

// ============================================================
// Helpers
// ============================================================

function parsePartialMermaid(args: Record<string, unknown> | undefined): Partial<DiagramState> {
  if (!args) return {};
  
  const result: Partial<DiagramState> = {};
  
  if (typeof args.mermaid === 'string') {
    result.mermaid = args.mermaid;
  }
  if (typeof args.theme === 'string') {
    result.theme = args.theme;
  }
  if (typeof args.title === 'string') {
    result.title = args.title;
  }
  
  return result;
}

/**
 * Sanitise a partial (still-streaming) mermaid string so the parser
 * has a better chance of producing output instead of throwing.
 *
 * Strategy:
 * 1. Drop the last (probably incomplete) line.
 * 2. Strip dangling HTML-like tags that were cut mid-tag, e.g. `<b`
 * 3. Balance any unclosed brackets / parentheses on the remaining
 *    tail so that node definitions are valid.
 */
function sanitizePartialMermaid(raw: string): string {
  if (!raw) return raw;

  const lines = raw.split('\n');

  // Always drop the last line – it is most likely incomplete.
  if (lines.length > 1) {
    lines.pop();
  } else {
    // Only one line (the diagram header like "flowchart TD") – return as-is
    return raw;
  }

  let cleaned = lines.join('\n');

  // Remove a trailing partial HTML tag, e.g.  "<b" or "<br" at the very end
  cleaned = cleaned.replace(/<[a-zA-Z/][^>]*$/m, '');

  // Remove a trailing partial entity, e.g.  "&amp" missing the semicolon
  cleaned = cleaned.replace(/&[a-zA-Z0-9#]*$/m, '');

  // Balance unclosed brackets on the *last* remaining line
  const lastNewline = cleaned.lastIndexOf('\n');
  const lastLine = lastNewline === -1 ? cleaned : cleaned.slice(lastNewline + 1);
  const openers: Record<string, string> = { '[': ']', '(': ')', '{': '}' };
  const stack: string[] = [];

  for (const ch of lastLine) {
    if (openers[ch]) {
      stack.push(openers[ch]);
    } else if (Object.values(openers).includes(ch)) {
      // Pop matching opener
      if (stack.length > 0 && stack[stack.length - 1] === ch) {
        stack.pop();
      }
    }
  }

  // Close any unclosed brackets so the node text is valid
  if (stack.length > 0) {
    cleaned += stack.reverse().join('');
  }

  return cleaned;
}

const ExpandIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 1.5H12.5V5.5" />
    <path d="M5.5 12.5H1.5V8.5" />
    <path d="M12.5 1.5L8 6" />
    <path d="M1.5 12.5L6 8" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 11v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" />
    <path d="M8 2v9" />
    <path d="M5 8l3 3 3-3" />
  </svg>
);

// ============================================================
// Main Component
// ============================================================

function MermaidApp() {
  const [diagramState, setDiagramState] = useState<DiagramState>({
    mermaid: "",
    theme: "default",
  });
  const [renderedSvg, setRenderedSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [displayMode, setDisplayMode] = useState<"inline" | "fullscreen">("inline");
  const [panZoom, setPanZoom] = useState<PanZoomState>({ scale: 1, translateX: 0, translateY: 0 });
  const [editedMermaid, setEditedMermaid] = useState("");
  
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const lastRenderTimeRef = useRef(0);
  const pendingRenderRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStreamingRef = useRef(false);
  const renderingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  const { app, error: appError } = useApp({
    appInfo: { name: "Mermaid Diagram App", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolinputpartial = async (input) => {
        setIsStreaming(true);
        isStreamingRef.current = true;
        const partial = parsePartialMermaid(input.arguments);
        if (partial.mermaid) {
          const sanitized = sanitizePartialMermaid(partial.mermaid);
          
          // Throttle: render at most once every 300ms, but always schedule
          // the latest version so it eventually renders.
          const now = Date.now();
          const elapsed = now - lastRenderTimeRef.current;

          if (pendingRenderRef.current) {
            clearTimeout(pendingRenderRef.current);
          }

          const doRender = async () => {
            if (renderingRef.current) return; // skip if a render is in progress
            lastRenderTimeRef.current = Date.now();
            await renderMermaid(sanitized, partial.theme || "default", true);
          };

          if (elapsed >= 300) {
            // Enough time passed since last render - render now
            doRender();
          } else {
            // Schedule render for the remaining time
            pendingRenderRef.current = setTimeout(doRender, 300 - elapsed);
          }
        }
      };

      app.ontoolinput = async (input) => {
        // Cancel any pending throttled render
        if (pendingRenderRef.current) {
          clearTimeout(pendingRenderRef.current);
          pendingRenderRef.current = null;
        }
        setIsStreaming(false);
        isStreamingRef.current = false;
        const args = input.arguments as Record<string, unknown>;
        const mermaidSyntax = (args.mermaid as string) || "";
        const theme = (args.theme as string) || "default";
        const title = args.title as string | undefined;
        
        setDiagramState({ mermaid: mermaidSyntax, theme, title });
        setEditedMermaid(mermaidSyntax);
        await renderMermaid(mermaidSyntax, theme, false);
      };

      app.ontoolresult = async (result) => {
        const { checkpointId, theme } = (result.structuredContent || {}) as Partial<DiagramState>;
        if (checkpointId) {
          setDiagramState((prev) => ({ ...prev, checkpointId, theme: theme || prev.theme }));
        }
      };

      app.onteardown = async () => {
        console.info("App is being torn down");
        return {};
      };

      app.onerror = (error) => {
        console.error("App error:", error);
        setError(error.message);
      };

      app.onhostcontextchanged = (params) => {
        // Handle theme changes if needed
        console.info("Host context changed:", params);
      };
    },
  });

  const renderMermaid = async (syntax: string, theme: string, isPartial = false) => {
    if (!syntax.trim()) return;
    if (renderingRef.current) return; // prevent concurrent renders
    renderingRef.current = true;

    try {
      mermaid.initialize({ 
        startOnLoad: false,
        theme: theme as any,
        securityLevel: 'loose',
      });

      // During streaming, pre-validate with parse() to avoid DOM
      // pollution from failed render() calls.
      if (isPartial) {
        try {
          await mermaid.parse(syntax);
        } catch {
          // Syntax not yet valid - keep the last successful SVG
          return;
        }
      }

      const id = `mermaid-${Date.now()}`;
      
      try {
        const { svg } = await mermaid.render(id, syntax);
        setRenderedSvg(svg);
        setError(null);
      } catch (renderErr: any) {
        // Clean up orphaned element that mermaid.render() may have created
        const orphan = document.getElementById('d' + id);
        if (orphan) orphan.remove();

        if (!isPartial) {
          console.error("Mermaid render error:", renderErr);
          setError(renderErr.message || "Failed to render diagram");
        }
      }
    } finally {
      renderingRef.current = false;
    }
  };

  // Pan/zoom handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (displayMode !== "inline") return;
    isPanningRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }, [displayMode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    
    setPanZoom((prev) => ({
      ...prev,
      translateX: prev.translateX + dx,
      translateY: prev.translateY + dy,
    }));
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (displayMode !== "inline") return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setPanZoom((prev) => ({
      ...prev,
      scale: Math.max(0.1, Math.min(5, prev.scale * delta)),
    }));
  }, [displayMode]);

  // Theme change handler
  const handleThemeChange = useCallback(async (newTheme: string) => {
    setDiagramState((prev) => ({ ...prev, theme: newTheme }));
    await renderMermaid(editedMermaid || diagramState.mermaid, newTheme, false);
  }, [editedMermaid, diagramState.mermaid]);

  // Export handler
  const handleExport = useCallback(async () => {
    if (!app || !renderedSvg) return;
    
    try {
      const result = await app.callServerTool({
        name: "export_svg",
        arguments: { svg: renderedSvg, format: "svg" },
      });

      if (!result.isError) {
        // Copy SVG to clipboard
        await navigator.clipboard.writeText(renderedSvg);
        console.info("SVG copied to clipboard");
      }
    } catch (err) {
      console.error("Export error:", err);
    }
  }, [app, renderedSvg]);

  // Fullscreen toggle
  const handleFullscreenToggle = useCallback(async () => {
    if (!app) return;
    
    const newMode = displayMode === "inline" ? "fullscreen" : "inline";
    setDisplayMode(newMode);
    
    try {
      await app.requestDisplayMode({ mode: newMode });
    } catch (err) {
      console.error("Display mode error:", err);
    }
  }, [app, displayMode]);

  // Handle mermaid edit in fullscreen mode
  const handleMermaidEdit = useCallback(async (newSyntax: string) => {
    setEditedMermaid(newSyntax);
    await renderMermaid(newSyntax, diagramState.theme, false);
    
    // Update model context
    if (app) {
      await app.updateModelContext({
        content: [
          {
            type: "text",
            text: `User edited the diagram:\n\`\`\`mermaid\n${newSyntax}\n\`\`\``,
          },
        ],
      });
    }
  }, [app, diagramState.theme]);

  if (appError) {
    return (
      <div className="error-container">
        <strong>ERROR:</strong> {appError.message}
      </div>
    );
  }

  if (!app) {
    return <div className="loading">Connecting...</div>;
  }

  if (displayMode === "fullscreen") {
    return (
      <div className="fullscreen-container">
        <div className="fullscreen-header">
          <h2>{diagramState.title || "Mermaid Diagram"}</h2>
          <div className="toolbar">
            <select
              value={diagramState.theme}
              onChange={(e) => handleThemeChange(e.target.value)}
              className="theme-select"
            >
              <option value="default">Default</option>
              <option value="forest">Forest</option>
              <option value="dark">Dark</option>
              <option value="neutral">Neutral</option>
              <option value="base">Base</option>
            </select>
            <button onClick={handleExport} className="icon-btn" title="Export SVG">
              <DownloadIcon />
            </button>
            <button onClick={handleFullscreenToggle} className="icon-btn" title="Exit Fullscreen">
              <ExpandIcon />
            </button>
          </div>
        </div>
        <div className="fullscreen-content">
          <div className="editor-panel">
            <textarea
              value={editedMermaid}
              onChange={(e) => handleMermaidEdit(e.target.value)}
              className="mermaid-editor"
              spellCheck={false}
              placeholder="Enter Mermaid syntax..."
            />
          </div>
          <div className="preview-panel">
            {error && <div className="error-banner">{error}</div>}
            <div
              className="svg-container"
              dangerouslySetInnerHTML={{ __html: renderedSvg }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="inline-container">
      <div className="inline-header">
        {diagramState.title && <h3 className="diagram-title">{diagramState.title}</h3>}
        <div className="toolbar">
          {isStreaming && <span className="streaming-indicator">Streaming...</span>}
          <button onClick={handleFullscreenToggle} className="icon-btn" title="Fullscreen">
            <ExpandIcon />
          </button>
        </div>
      </div>
      {error && <div className="error-banner">{error}</div>}
      <div
        ref={svgContainerRef}
        className="svg-container"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{
          transform: `translate(${panZoom.translateX}px, ${panZoom.translateY}px) scale(${panZoom.scale})`,
          cursor: isPanningRef.current ? "grabbing" : "grab",
        }}
        dangerouslySetInnerHTML={{ __html: renderedSvg }}
      />
    </div>
  );
}

// ============================================================
// Bootstrap
// ============================================================

createRoot(document.getElementById("root")!).render(<MermaidApp />);
