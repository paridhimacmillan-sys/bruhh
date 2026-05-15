import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from './useStore';
import { renderMd } from './renderMd';
import ActivityBar from './ActivityBar';
import TitleBar from './TitleBar';

// ─── Language Colors ─────────────────────────────────────────
const LANG_COLORS = {
  javascript: '#f7c948',
  typescript: '#3b82f6',
  python: '#4ade80',
  html: '#fb923c',
  css: '#a78bfa',
  json: '#22d3ee',
  markdown: '#e2e8f0',
  rust: '#f97316',
  cpp: '#60a5fa',
  default: '#8888aa',
};

function getLangColor(lang) {
  return LANG_COLORS[lang] || LANG_COLORS.default;
}

// ─── Syntax Highlighting ─────────────────────────────────────
function highlight(code, lang) {
  if (!code) return '';

  const esc = (s) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  let c = esc(code);

  c = c
    .replace(
      /(\/\/[^\n]*)/g,
      '<span style="color:#666">$1</span>'
    )
    .replace(
      /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
      '<span style="color:#4ade80">$1</span>'
    )
    .replace(
      /\b(import|export|from|const|let|var|function|return|if|else|for|while|async|await|new|class)\b/g,
      '<span style="color:#a78bfa">$1</span>'
    )
    .replace(
      /\b(true|false|null|undefined)\b/g,
      '<span style="color:#22d3ee">$1</span>'
    );

  return c;
}

// ─── Sidebar ─────────────────────────────────────────────────
function Sidebar() {
  const { activePanel } = useStore();

  return (
    <div
      style={{
        width: 240,
        background: 'var(--bg1)',
        borderRight: '1px solid var(--line)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '10px 12px',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text3)',
          borderBottom: '1px solid var(--line)',
          textTransform: 'uppercase',
          letterSpacing: '.08em',
        }}
      >
        {activePanel}
      </div>

      {activePanel === 'files' && <ExplorerPanel />}
      {activePanel === 'search' && <SearchPanel />}
      {activePanel === 'git' && <GitPanel />}
      {activePanel === 'extensions' && <ExtensionsPanel />}
    </div>
  );
}

// ─── Explorer Panel ──────────────────────────────────────────
function ExplorerPanel() {
  const { fileTree, openFile } = useStore();

  return (
    <div style={{ padding: 8 }}>
      {fileTree.map((file, i) => (
        <div
          key={i}
          onClick={() => openFile(file.path, file.name)}
          style={{
            padding: '6px 8px',
            borderRadius: 4,
            cursor: 'pointer',
            color: 'var(--text2)',
            fontSize: 12,
          }}
        >
          📄 {file.name}
        </div>
      ))}
    </div>
  );
}

// ─── Search Panel ────────────────────────────────────────────
function SearchPanel() {
  return (
    <div style={{ padding: 12 }}>
      <input
        placeholder="Search..."
        style={{
          width: '100%',
          padding: 8,
          background: 'var(--bg3)',
          border: '1px solid var(--line)',
          color: 'var(--text)',
          borderRadius: 6,
        }}
      />
    </div>
  );
}

// ─── Git Panel ───────────────────────────────────────────────
function GitPanel() {
  return (
    <div style={{ padding: 12, color: 'var(--text2)' }}>
      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="Commit message..."
          style={{
            width: '100%',
            padding: 8,
            background: 'var(--bg3)',
            border: '1px solid var(--line)',
            color: 'var(--text)',
            borderRadius: 6,
          }}
        />
      </div>

      <button
        style={{
          width: '100%',
          padding: '8px 0',
          background: 'var(--acc)',
          border: 'none',
          color: '#fff',
          borderRadius: 6,
          fontWeight: 600,
        }}
      >
        Commit
      </button>
    </div>
  );
}

// ─── Extensions Panel ────────────────────────────────────────
function ExtensionsPanel() {
  const extensions = [
    'Prettier',
    'ESLint',
    'GitLens',
    'Tailwind CSS',
  ];

  return (
    <div style={{ padding: 8 }}>
      {extensions.map((e) => (
        <div
          key={e}
          style={{
            padding: '10px 12px',
            marginBottom: 6,
            background: 'var(--bg2)',
            border: '1px solid var(--line)',
            borderRadius: 6,
            color: 'var(--text2)',
            fontSize: 12,
          }}
        >
          {e}
        </div>
      ))}
    </div>
  );
}

// ─── Tab Bar ─────────────────────────────────────────────────
function TabBar() {
  const { openTabs, activeTab, closeTab, openFile } = useStore();

  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--bg1)',
        borderBottom: '1px solid var(--line)',
        height: 35,
      }}
    >
      {openTabs.map((tab) => (
        <div
          key={tab}
          onClick={() => openFile(tab, tab)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            borderRight: '1px solid var(--line)',
            cursor: 'pointer',
            background:
              activeTab === tab ? 'var(--bg2)' : 'transparent',
            color:
              activeTab === tab
                ? 'var(--text)'
                : 'var(--text3)',
            fontSize: 12,
          }}
        >
          {tab}

          <button
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab);
            }}
            style={{
              marginLeft: 8,
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Code Editor ─────────────────────────────────────────────
function CodeEditor() {
  const { activeTab, files, updateFileContent } = useStore();

  const textareaRef = useRef();
  const highlightRef = useRef();

  const file = activeTab ? files[activeTab] : null;

  const syncScroll = useCallback(() => {
    if (!textareaRef.current || !highlightRef.current) return;

    highlightRef.current.scrollTop =
      textareaRef.current.scrollTop;

    highlightRef.current.scrollLeft =
      textareaRef.current.scrollLeft;
  }, []);

  if (!file) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text3)',
        }}
      >
        Open a file to begin
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <pre
        ref={highlightRef}
        aria-hidden="true"
        dangerouslySetInnerHTML={{
          __html: highlight(file.content, file.lang),
        }}
        style={{
          position: 'absolute',
          inset: 0,
          margin: 0,
          padding: 16,
          overflow: 'auto',
          pointerEvents: 'none',
          fontFamily: 'var(--mono)',
          fontSize: 13,
          lineHeight: '20px',
          whiteSpace: 'pre',
        }}
      />

      <textarea
        ref={textareaRef}
        value={file.content}
        onChange={(e) =>
          updateFileContent(activeTab, e.target.value)
        }
        onScroll={syncScroll}
        spellCheck={false}
        style={{
          position: 'absolute',
          inset: 0,
          padding: 16,
          background: 'transparent',
          color: 'transparent',
          caretColor: 'var(--acc2)',
          border: 'none',
          outline: 'none',
          resize: 'none',
          overflow: 'auto',
          fontFamily: 'var(--mono)',
          fontSize: 13,
          lineHeight: '20px',
          whiteSpace: 'pre',
        }}
      />
    </div>
  );
}

// ─── AI Panel ────────────────────────────────────────────────
function AiPanel() {
  const {
    aiMessages,
    sendAiMessage,
    aiStreaming,
  } = useStore();

  const [input, setInput] = useState('');

  const send = () => {
    if (!input.trim()) return;

    sendAiMessage(input);
    setInput('');
  };

  return (
    <div
      style={{
        width: 320,
        background: 'var(--bg1)',
        borderLeft: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: 12,
          borderBottom: '1px solid var(--line)',
          fontWeight: 600,
          color: 'var(--text)',
        }}
      >
        DevMind AI
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
        }}
      >
        {aiMessages.map((msg) => (
          <div
            key={msg.id}
            style={{
              marginBottom: 12,
              color: 'var(--text2)',
              fontSize: 13,
            }}
          >
            <div
              dangerouslySetInnerHTML={{
                __html: renderMd(msg.text),
              }}
            />
          </div>
        ))}
      </div>

      <div
        style={{
          padding: 10,
          borderTop: '1px solid var(--line)',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 8,
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask DevMind AI..."
            rows={2}
            style={{
              flex: 1,
              background: 'var(--bg3)',
              border: '1px solid var(--line)',
              color: 'var(--text)',
              borderRadius: 6,
              padding: 8,
              resize: 'none',
            }}
          />

          <button
            onClick={send}
            disabled={aiStreaming}
            style={{
              width: 42,
              background: 'var(--acc)',
              border: 'none',
              color: '#fff',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Terminal ────────────────────────────────────────────────
function Terminal() {
  const { termLines, runTerminalCommand } = useStore();

  const [cmd, setCmd] = useState('');

  const submit = () => {
    if (!cmd.trim()) return;

    runTerminalCommand(cmd);
    setCmd('');
  };

  return (
    <div
      style={{
        height: 220,
        background: '#111',
        borderTop: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
          fontFamily: 'var(--mono)',
          fontSize: 12,
          color: '#ccc',
        }}
      >
        {termLines.map((line, i) => (
          <div key={i}>{line.text}</div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: 10,
          borderTop: '1px solid #222',
        }}
      >
        <span
          style={{
            marginRight: 8,
            color: '#4ade80',
          }}
        >
          ❯
        </span>

        <input
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            color: '#fff',
            fontFamily: 'var(--mono)',
          }}
        />
      </div>
    </div>
  );
}

// ─── Status Bar ──────────────────────────────────────────────
function StatusBar() {
  const { connected } = useStore();

  return (
    <div
      style={{
        height: 22,
        background: connected
          ? 'var(--acc)'
          : 'var(--bg4)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        fontSize: 11,
      }}
    >
      {connected ? 'Connected' : 'Disconnected'}
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────
export default function App() {
  const { aiPanelOpen } = useStore();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg)',
      }}
    >
      <TitleBar />

      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        <ActivityBar />

        <Sidebar />

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <TabBar />

          <CodeEditor />

          <Terminal />
        </div>

        {aiPanelOpen && <AiPanel />}
      </div>

      <StatusBar />
    </div>
  );
}
