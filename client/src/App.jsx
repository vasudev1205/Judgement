import React, { useEffect } from 'react';
import { useGameStore } from './store/useGameStore.js';
import { useSocket } from './hooks/useSocket.js';
import Dashboard from './components/Dashboard.jsx';
import GameTable from './components/GameTable.jsx';
import { AnimatePresence, motion } from 'framer-motion';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-[#0f111a] text-white">
          <div className="glass-panel p-8 rounded-3xl max-w-md w-full text-center space-y-4">
            <span className="text-4xl">⚠️</span>
            <h3 className="text-xl font-bold">Failed to load Game Table</h3>
            <p className="text-xs text-slate-400">
              An unexpected rendering error occurred. Please try reconnecting or reloading the page.
            </p>
            <button
              onClick={() => {
                localStorage.removeItem('kachuful_room_code');
                localStorage.removeItem('kachuful_session_token');
                window.location.reload();
              }}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-4 rounded-xl text-xs"
            >
              Reset & Go to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const { 
    playMode, 
    error
  } = useGameStore();

  // Initialize Socket.IO singleton hook
  useSocket();

  return (
    <div className="min-h-screen relative w-full overflow-y-auto selection:bg-purple-600 selection:text-white">
      {/* Global Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 12 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-4 right-4 md:left-auto md:right-4 z-[999] md:w-96 glass-panel border-red-500/30 p-4 rounded-xl flex items-start gap-3 shadow-lg"
          >
            <div className="bg-red-500/20 text-red-400 p-1.5 rounded-lg text-sm">⚠️</div>
            <div className="flex-1">
              <div className="font-semibold text-white text-sm">Error Occurred</div>
              <div className="text-xs text-slate-300 mt-1">{error}</div>
            </div>
            <button 
              onClick={() => useGameStore.setState({ error: null })} 
              className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/5"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main View Router */}
      {playMode ? (
        <ErrorBoundary>
          <GameTable />
        </ErrorBoundary>
      ) : (
        <Dashboard />
      )}
    </div>
  );
}

export default App;
