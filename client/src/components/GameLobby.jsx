import React, { useState } from 'react';
import { useGameStore } from '../store/useGameStore.js';
import { Users, Copy, Check, Play, LogOut, Settings, Award } from 'lucide-react';
import { motion } from 'framer-motion';

function GameLobby() {
  const {
    roomCode,
    players,
    spectators,
    playerId,
    onlineLeaveRoom,
    onlineKickPlayer,
    onlineStartGame,
    maxRounds,
    onlineUpdateMaxRounds,
    scoreMode: storeScoreMode,
    lastBidRestriction: storeLastBidRestriction
  } = useGameStore();

  const [copied, setCopied] = useState(false);
  const [scoreMode, setScoreMode] = useState('MODE1');
  const [lastBidRestriction, setLastBidRestriction] = useState(true);

  // Check if current user is host
  const me = players.find(p => p.id === playerId);
  const isHost = me?.isHost;

  const maxPossibleRounds = Math.floor(52 / (players.length || 1));
  const currentMaxRounds = (maxRounds && maxRounds > 0 && maxRounds <= maxPossibleRounds) ? maxRounds : maxPossibleRounds;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartGame = () => {
    onlineStartGame(scoreMode, lastBidRestriction);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl glass-panel p-8 rounded-3xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl -z-10"></div>
        
        {/* Lobby Top */}
        <div className="flex justify-between items-start gap-4 mb-8">
          <div>
            <span className="text-[10px] bg-purple-500/20 text-purple-400 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
              MULTIPLAYER LOBBY
            </span>
            <h2 className="text-2xl font-black text-white mt-2 tracking-wide uppercase">Waiting Room</h2>
          </div>
          
          <button
            onClick={onlineLeaveRoom}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 text-xs font-bold transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Leave</span>
          </button>
        </div>

        {/* Room Code Showcase */}
        <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-5 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Share Room Code</div>
            <div className="text-4xl font-black text-white tracking-widest mt-1 glow-text-purple">{roomCode}</div>
          </div>
          <button
            onClick={handleCopyCode}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-md active:scale-95 text-sm"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied!' : 'Copy Code'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start mb-8">
          {/* Players List */}
          <div className="space-y-4">
            <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              <span>Players ({players.length}/10)</span>
            </h4>
            
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {players.map((p) => (
                <div 
                  key={p.id} 
                  className={`flex items-center justify-between p-3 rounded-xl border ${
                    p.id === playerId 
                      ? 'bg-purple-950/20 border-purple-500/20 text-white font-bold'
                      : 'bg-slate-950/20 border-white/5 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{p.avatar}</span>
                    <span className="text-sm truncate max-w-[150px]">{p.name}</span>
                    {p.isHost && (
                      <span className="text-[9px] bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-bold px-1.5 py-0.5 rounded-full uppercase">
                        Admin
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${p.connected ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                    <span className="text-[10px] text-slate-400">{p.connected ? 'Online' : 'Disconnected'}</span>
                  </div>

                  {isHost && p.id !== playerId && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Kick ${p.name} from the room?`)) {
                          onlineKickPlayer(p.id);
                        }
                      }}
                      className="ml-3 shrink-0 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 hover:text-white text-[10px] font-bold transition-colors"
                    >
                      Kick
                    </button>
                  )}
                </div>
              ))}
            </div>

            {spectators.length > 0 && (
              <div className="pt-2">
                <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Spectators ({spectators.length})</h5>
                <div className="flex flex-wrap gap-2">
                  {spectators.map(s => (
                    <span key={s.id} className="text-xs bg-slate-900 border border-white/5 py-1 px-2.5 rounded-lg text-slate-400 font-semibold flex items-center gap-1">
                      <span>👁️</span> {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Game Settings Setup */}
          <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-6 space-y-5">
            <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
              <Settings className="w-4 h-4 text-purple-400" />
              <span>Game Settings</span>
            </h4>

            {isHost ? (
              // Host Interactive Controls
              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-medium block">Round Limit:</label>
                  <select 
                    value={currentMaxRounds} 
                    onChange={(e) => onlineUpdateMaxRounds(parseInt(e.target.value))}
                    className="w-full glass-input p-2.5 rounded-lg bg-slate-900 border-white/10 text-white font-bold cursor-pointer"
                  >
                    {Array.from({ length: maxPossibleRounds }, (_, i) => i + 1).map((r) => (
                      <option key={r} value={r}>
                        {r} {r === maxPossibleRounds ? '(Max)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  <label className="text-slate-400 font-medium block">Score Mode:</label>
                  <select 
                    value={scoreMode} 
                    onChange={(e) => setScoreMode(e.target.value)}
                    className="w-full glass-input p-2.5 rounded-lg bg-slate-900 border-white/10 text-white font-bold cursor-pointer"
                  >
                    <option value="MODE1">Mode 1: 10 + Tricks Won (Standard)</option>
                    <option value="MODE2">Mode 2: Tricks x 10 (Multiplier)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2.5 pt-2 border-t border-white/5">
                  <input 
                    type="checkbox" 
                    id="lastBidHostCheck" 
                    checked={lastBidRestriction}
                    onChange={(e) => setLastBidRestriction(e.target.checked)}
                    className="rounded bg-slate-900 border-white/10 text-purple-600 focus:ring-purple-600 h-4 w-4 cursor-pointer"
                  />
                  <label htmlFor="lastBidHostCheck" className="text-slate-300 font-medium select-none cursor-pointer">
                    Enable Last Bid Restriction
                  </label>
                </div>
              </div>
            ) : (
              // Read-only parameters for non-hosts
              <div className="space-y-3.5 text-xs">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-400">Round Limit:</span>
                  <span className="text-white font-bold">{currentMaxRounds}</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-400">Score Mode:</span>
                  <span className="text-white font-bold uppercase">
                    {storeScoreMode === 'MODE2' ? 'Mode 2 (Multiplier)' : 'Mode 1 (Standard)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Last Bid Constraint:</span>
                  <span className={`font-bold uppercase ${storeLastBidRestriction ? 'text-emerald-400' : 'text-red-400'}`}>
                    {storeLastBidRestriction ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            )}

            {/* Start Button details */}
            <div className="pt-2">
              {isHost ? (
                <button
                  onClick={handleStartGame}
                  disabled={players.length < 2}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 disabled:border-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-purple-950/40 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>START GAME</span>
                </button>
              ) : (
                <div className="text-center bg-purple-950/15 border border-purple-500/10 p-3.5 rounded-xl text-purple-300 text-xs font-semibold animate-pulse-subtle">
                  ⏳ Waiting for Admin to start match...
                </div>
              )}
            </div>
          </div>
        </div>

      </motion.div>
    </div>
  );
}

export default GameLobby;
