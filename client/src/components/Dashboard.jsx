import React, { useState } from 'react';
import { useGameStore } from '../store/useGameStore.js';
import { Play, Users, Sparkles, Plus, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

const AVATARS = ['🐼', '🦊', '🦁', '🐸', '🐨', '🐯', '🐵', '🦉', '🐱', '🐶'];

function Dashboard() {
  const {
    playerName,
    playerAvatar,
    stats,
    saveProfile,
    offlineStartGame,
    onlineCreateRoom,
    onlineJoinRoom,
    isConnecting
  } = useGameStore();

  const [editName, setEditName] = useState(playerName);
  const [selectedAvatar, setSelectedAvatar] = useState(playerAvatar);
  const [joinCode, setJoinCode] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Settings for Offline Launch
  const [offlineBots, setOfflineBots] = useState(3);
  const [scoreMode, setScoreMode] = useState('MODE1');
  const [lastBidRestriction, setLastBidRestriction] = useState(true);
  const [offlineMaxRounds, setOfflineMaxRounds] = useState(13);

  const maxPossibleOfflineRounds = Math.floor(52 / (1 + offlineBots));
  const currentOfflineMaxRounds = Math.min(offlineMaxRounds, maxPossibleOfflineRounds);

  const [cheatClicks, setCheatClicks] = useState(0);
  const { cheatActive, toggleCheat } = useGameStore();

  const handleSecretClick = () => {
    const newClicks = cheatClicks + 1;
    setCheatClicks(newClicks);
    if (newClicks >= 5) {
      toggleCheat();
      setCheatClicks(0);
      // Optional: Remove this alert later if you want it to be completely silent
      alert(cheatActive ? "God Mode DISABLED" : "God Mode ENABLED.");
    }
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (editName.trim()) {
      saveProfile(editName.trim(), selectedAvatar);
      setShowProfileModal(false);
    }
  };

  const calculateSuccessRate = () => {
    if (stats.gamesPlayed === 0) return 0;
    return Math.round((stats.correctGuesses / (stats.gamesPlayed * 5)) * 100); // estimated guess opportunities
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl min-h-screen flex flex-col justify-between">
      {/* Header Profile Panel */}
      <header className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12 glass-panel p-6 rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -z-10"></div>
        <div className="flex items-center gap-5">
          <div 
            onClick={() => setShowProfileModal(true)}
            className="w-20 h-20 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center text-4xl shadow-xl shadow-purple-900/40 cursor-pointer border border-white/10 hover:scale-105 transition-transform"
          >
            {playerAvatar}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-extrabold text-white tracking-wide">{playerName}</h2>
              <button 
                onClick={() => setShowProfileModal(true)} 
                className="text-xs text-purple-400 hover:text-purple-300 font-medium px-2 py-0.5 rounded bg-purple-950/40 border border-purple-800/30"
              >
                Edit
              </button>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5 bg-slate-900/50 border border-white/5 px-3 py-1 rounded-full text-sm text-slate-300 font-bold">
                <span>📊</span>
                <span>{stats.gamesPlayed} Games Played</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard Panel */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start mb-8">
        
        {/* Navigation Columns */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Game Modes & Settings selector */}
          <section className="glass-panel p-8 rounded-3xl relative">
            <div className="absolute top-4 right-4 text-purple-500/20"><Sparkles className="w-24 h-24" /></div>
            
            {/* Add onClick here */}
              <h1 onClick={handleSecretClick} className="text-4xl font-black text-white mb-6 uppercase tracking-wider glow-text-purple select-none cursor-default">
                KACHUFUL
              </h1>
            <p className="text-slate-300 text-sm leading-relaxed mb-8">
              A trick-taking card game of forecasting and judgement. Place your bid correctly in each round to score points. If you score exactly what you guessed, you win!
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Play Offline Section */}
              <div className="bg-slate-950/40 border border-white/5 p-6 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <Play className="w-5 h-5" />
                  <h3>PLAY OFFLINE</h3>
                </div>
                <p className="text-xs text-slate-400">Play locally against intelligent bots instantly. No lobby wait.</p>
                
                {/* Bot Settings */}
                <div className="space-y-3 pt-2 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Bot Count ({offlineBots} Bots):</label>
                    <input 
                      type="range" min="1" max="9" value={offlineBots}
                      onChange={(e) => setOfflineBots(parseInt(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-slate-400 block mb-1">Score Mode:</label>
                      <select 
                        value={scoreMode} onChange={(e) => setScoreMode(e.target.value)}
                        className="w-full glass-input p-2 rounded-lg bg-slate-900 border-white/10 text-white"
                      >
                        <option value="MODE1">Mode 1: 10 + Tricks</option>
                        <option value="MODE2">Mode 2: Tricks x 10</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-slate-400 block mb-1">Round Limit:</label>
                      <select 
                        value={currentOfflineMaxRounds} 
                        onChange={(e) => setOfflineMaxRounds(parseInt(e.target.value))}
                        className="w-full glass-input p-2 rounded-lg bg-slate-900 border-white/10 text-white"
                      >
                        {Array.from({ length: maxPossibleOfflineRounds }, (_, i) => i + 1).map((r) => (
                          <option key={r} value={r}>
                            {r} {r === maxPossibleOfflineRounds ? '(Max)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input 
                      type="checkbox" id="lastBidCheck" checked={lastBidRestriction}
                      onChange={(e) => setLastBidRestriction(e.target.checked)}
                      className="rounded bg-slate-900 border-white/10 text-purple-600 focus:ring-purple-600"
                    />
                    <label htmlFor="lastBidCheck" className="text-slate-400 select-none cursor-pointer">Last Bid Restriction</label>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const totalPlayers = 1 + offlineBots;
                    if (totalPlayers > 10) {
                      alert("Maximum 10 players allowed");
                      return;
                    }
                    try {
                      offlineStartGame(scoreMode, lastBidRestriction, currentOfflineMaxRounds);
                    } catch (err) {
                      alert(err.message);
                    }
                  }}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-purple-950/40 hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 pt-3"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>PLAY VS BOTS</span>
                </button>
              </div>

              {/* Play Online Section */}
              <div className="bg-slate-950/40 border border-white/5 p-6 rounded-2xl space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-purple-400 font-bold">
                    <Users className="w-5 h-5" />
                    <h3>PLAY ONLINE</h3>
                  </div>
                  <p className="text-xs text-slate-400">Host or join rooms using a 3-letter room code to play with friends.</p>

                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="ROOM CODE (e.g. ABC)"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        maxLength={3}
                        className="flex-1 glass-input py-2.5 px-3 rounded-xl uppercase font-bold tracking-wider text-center text-sm"
                      />
                      <div className="flex flex-col gap-1.5 w-24">
                        <button
                          onClick={() => {
                            if (joinCode.length === 3) onlineJoinRoom(joinCode);
                            else alert('Enter a valid 3-letter code.');
                          }}
                          disabled={isConnecting}
                          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-1.5 rounded-lg font-bold text-xs"
                        >
                          JOIN
                        </button>
                        <button
                          onClick={() => {
                            if (joinCode.length === 3) onlineJoinRoom(joinCode, true); // true = asSpectator
                            else alert('Enter a valid 3-letter code.');
                          }}
                          disabled={isConnecting}
                          className="bg-slate-700 hover:bg-slate-600 border border-slate-500/50 disabled:opacity-50 text-slate-200 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider"
                        >
                          Spectate
                        </button>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => {
                        // Pass current local settings for score / restriction
                        onlineCreateRoom();
                      }}
                      disabled={isConnecting}
                      className="w-full bg-slate-900 hover:bg-slate-800 border border-purple-500/20 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>CREATE ROOM</span>
                    </button>
                  </div>
                </div>

                <div className="text-[10px] text-center text-slate-500 mt-2">
                  No account needed. Connect, share code, and play.
                </div>
              </div>

            </div>
          </section>

          <section className="bg-slate-950/20 border border-white/5 rounded-3xl p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                <div className="text-2xl font-black text-purple-400">{stats.gamesPlayed}</div>
                <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Games Played</div>
              </div>
              <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                <div className="text-2xl font-black text-emerald-400">{stats.gamesWon}</div>
                <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Games Won</div>
              </div>
              <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                <div className="text-2xl font-black text-sky-400">{stats.tricksWon}</div>
                <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Tricks Won</div>
              </div>
              <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                <div className="text-2xl font-black text-yellow-400">{calculateSuccessRate()}%</div>
                <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Guess Accuracy</div>
              </div>
            </div>
          </section>

        </div>

        {/* Sidebar Info Rules */}
        <div className="space-y-8">
          <section className="glass-panel p-6 rounded-3xl border-purple-500/10">
            <h4 className="font-bold text-white text-base mb-4 flex items-center gap-1.5">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <span>Kachuful Rules</span>
            </h4>
            <ul className="text-xs text-slate-300 space-y-3.5 list-disc list-inside">
              <li>Cards dealt equal the round number (e.g. 1 card in Round 1).</li>
              <li>At the start of the round, you forecast (bid) how many tricks you'll win.</li>
              <li><strong>Last Bid restriction:</strong> The dealer cannot bid a number making total bids equal to total tricks of the round.</li>
              <li>Trump suit beats all standard suits. A new trump suit is chosen randomly at the start of each round.</li>
              <li>If no trumps are played, the first card's suit acts as trump for that trick. Highest card of leading suit wins.</li>
              <li>If you make your forecast exactly, you score. Otherwise, you score 0.</li>
            </ul>
          </section>
        </div>

      </main>

      {/* Profile Customize Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel p-8 rounded-3xl border-purple-500/20 relative">
            <h3 className="text-xl font-extrabold text-white mb-6">Customize Profile</h3>
            
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div>
                <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-2">Display Name</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={12}
                  className="w-full glass-input py-3 px-4 rounded-xl text-white font-bold"
                  placeholder="Enter Name"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-3">Choose Avatar</label>
                <div className="grid grid-cols-5 gap-3">
                  {AVATARS.map(avatar => (
                    <button
                      key={avatar}
                      type="button"
                      onClick={() => setSelectedAvatar(avatar)}
                      className={`text-2xl p-2.5 rounded-xl transition-all ${
                        selectedAvatar === avatar 
                          ? 'bg-purple-600/35 border-2 border-purple-400 shadow-purple-500/20' 
                          : 'bg-slate-900 border border-white/5 hover:bg-slate-800'
                      }`}
                    >
                      {avatar}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl border border-white/5 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 rounded-xl text-sm hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-950/20"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500 py-4 mt-8 border-t border-white/5">
        &copy; {new Date().getFullYear()} Kachuful Card Game. Built with React & Tailwind CSS.
      </footer>
    </div>
  );
}

export default Dashboard;
