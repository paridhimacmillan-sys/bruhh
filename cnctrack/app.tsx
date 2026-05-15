import './App.css'

function App() {
  return (
    <div className="app">

      {/* Sidebar */}
      <div className="sidebar">
        <div className="logo">⚡</div>

        <div className="sidebar-icons">
          <div>📁</div>
          <div>🔍</div>
          <div>🌿</div>
          <div>🤖</div>
        </div>
      </div>

      {/* Explorer */}
      <div className="explorer">
        <h3>EXPLORER</h3>

        <div className="file">📄 App.jsx</div>
        <div className="file">📄 main.jsx</div>
        <div className="file">📄 store.js</div>
      </div>

      {/* Main Editor */}
      <div className="editor-section">

        <div className="tabs">
          <div className="tab active">App.jsx</div>
          <div className="tab">main.jsx</div>
        </div>

        <div className="editor">
{`function hello() {
  console.log("DevMind Studio");
}`}
        </div>

        <div className="terminal">
          <div>Terminal</div>

          <div className="terminal-content">
            npm run dev
          </div>
        </div>

      </div>

      {/* AI Chat */}
      <div className="chat-panel">

        <div className="chat-header">
          DevMind AI
        </div>

        <div className="chat-messages">
          <div className="message ai">
            Hello! I can help you code.
          </div>

          <div className="message user">
            Build a React dashboard
          </div>
        </div>

        <input
          className="chat-input"
          placeholder="Ask AI..."
        />

      </div>

    </div>
  )
}

export default App
