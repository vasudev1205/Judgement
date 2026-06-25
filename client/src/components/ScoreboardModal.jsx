import { useGameStore } from '../store/useGameStore.js';
import { Trophy, ArrowRight, Table } from 'lucide-react';
import { motion } from 'framer-motion';

function ScoreboardModal() {
  const {
    players,
    roundNumber,
    maxRounds,
    scoreMode,
    playMode,
    playerId,
    phase,
    lastBidRestriction,
    onlineContinueNextRound,
    offlineContinueNextRound,
    offlineStartGame
  } = useGameStore();

  const handleContinue = () => {
    if (playMode === 'ONLINE') {
      onlineContinueNextRound();
    } else {
      offlineContinueNextRound();
    }
  };

  const isLastRound = roundNumber === maxRounds || phase === 'FINISHED';
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const winner = sortedPlayers[0];
  const winnerName = winner ? winner.name : '';
  const winnerScore = winner ? winner.score : 0;
  const me = players.find(p => p.id === playerId);
  const isHost = me?.isHost;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-3xl glass-panel-glow border-purple-500/20 p-8 rounded-3xl relative overflow-hidden max-h-[90vh] flex flex-col justify-between"
      >
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl -z-10"></div>
        
        {/* Header / Game Finished Banner */}
        {isLastRound ? (
          <div className="text-center p-6 bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-purple-950/40 rounded-2xl border border-purple-500/20 mb-6 shadow-lg shadow-purple-950/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl -z-10"></div>
            <h2 className="text-3xl font-black text-white tracking-widest flex items-center justify-center gap-2 glow-text-purple animate-pulse-subtle">
              🏆 GAME FINISHED
            </h2>
            <div className="mt-4 space-y-1.5 bg-slate-950/30 py-3.5 px-6 rounded-xl border border-white/5 inline-block min-w-[200px]">
              <div className="text-xl font-black text-white">Winner : <span className="text-yellow-400">{winnerName}</span></div>
              <div className="text-xl font-black text-white">Score : {winnerScore}</div>
            </div>
          </div>
        ) : (
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-purple-500/10 text-purple-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Trophy className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-black text-white tracking-wide uppercase">
              Round {roundNumber} Complete
            </h3>
            <p className="text-slate-400 text-xs mt-1">
              Score Mode: {scoreMode === 'MODE2' ? 'Multiplier (Mode 2)' : 'Standard (Mode 1)'}
            </p>
          </div>
        )}

        {/* Scrollable Scores */}
        <div className="flex-1 overflow-y-auto mb-8 border border-white/5 rounded-2xl bg-slate-950/20">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-slate-900/60 text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-4 px-5">Rank</th>
                <th className="py-4 px-5">Player</th>
                <th className="py-4 px-5 text-center">Guess</th>
                <th className="py-4 px-5 text-center">Won</th>
                <th className="py-4 px-5 text-right">Round Score</th>
                <th className="py-4 px-5 text-right">Total Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {[...players]
                .sort((a, b) => b.score - a.score)
                .map((p, idx) => {
                  const roundIdx = roundNumber - 1;
                  const roundBid = p.roundGuesses && p.roundGuesses[roundIdx] !== undefined ? p.roundGuesses[roundIdx] : p.bid;
                  const roundWon = p.roundWins && p.roundWins[roundIdx] !== undefined ? p.roundWins[roundIdx] : p.tricksWon;
                  const roundScore = p.roundScores && p.roundScores[roundIdx] !== undefined ? p.roundScores[roundIdx] : 0;
                  
                  const isCurrent = p.id === playerId;
                  const isGuessCorrect = roundBid === roundWon;

                  return (
                    <tr 
                      key={p.id} 
                      className={`transition-colors ${
                        isCurrent 
                          ? 'bg-purple-600/10 text-white' 
                          : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <td className="py-4 px-5 font-bold">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </td>
                      <td className="py-4 px-5 font-bold flex items-center gap-2">
                        <span className="text-xl">{p.avatar}</span>
                        <span>{p.name}</span>
                        {p.isBot && <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-black">BOT</span>}
                        {isCurrent && <span className="text-[10px] bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full font-bold">YOU</span>}
                      </td>
                      <td className="py-4 px-5 text-center font-bold text-slate-400">
                        {roundBid}
                      </td>
                      <td className={`py-4 px-5 text-center font-extrabold ${
                        isGuessCorrect ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {roundWon}
                      </td>
                      <td className={`py-4 px-5 text-right font-black ${
                        roundScore > 0 ? 'text-emerald-400' : 'text-slate-500'
                      }`}>
                        +{roundScore}
                      </td>
                      <td className="py-4 px-5 text-right font-black text-white">
                        {p.score} pts
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Footer actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5 pt-6">
          <div className="text-xs text-slate-400">
            {!isLastRound ? (
              <span>Next round deal: <strong>{roundNumber + 1} cards</strong> (Max rounds: {maxRounds})</span>
            ) : (
              <span className="text-purple-400 font-bold">Game Finished! Check the final scores.</span>
            )}
          </div>
          
          <div className="w-full sm:w-auto flex flex-wrap gap-3">
            {isLastRound ? (
              <>
                {playMode === 'OFFLINE' ? (
                  <>
                    <button
                      onClick={() => offlineStartGame(scoreMode, lastBidRestriction, maxRounds)}
                      className="flex-1 sm:flex-initial bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg active:scale-95 transition-all text-xs uppercase tracking-wider"
                    >
                      PLAY AGAIN
                    </button>
                    <button
                      onClick={() => useGameStore.getState().disconnectSocket()}
                      className="flex-1 sm:flex-initial bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 font-bold py-3 px-6 rounded-xl shadow-lg active:scale-95 transition-all text-xs uppercase tracking-wider"
                    >
                      RETURN TO LOBBY
                    </button>
                  </>
                ) : (
                  <>
                    {/* Online Multiplayer */}
                    {isHost ? (
                      <>
                        <button
                          onClick={() => useGameStore.getState().onlinePlayAgain()}
                          className="flex-1 sm:flex-initial bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg active:scale-95 transition-all text-xs uppercase tracking-wider"
                        >
                          PLAY AGAIN
                        </button>
                        <button
                          onClick={() => useGameStore.getState().onlineReturnToLobby()}
                          className="flex-1 sm:flex-initial bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg active:scale-95 transition-all text-xs uppercase tracking-wider"
                        >
                          RETURN TO LOBBY
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="text-xs text-slate-500 flex items-center pr-2">
                          Waiting for host to restart or return...
                        </div>
                        <button
                          onClick={() => useGameStore.getState().onlineLeaveRoom()}
                          className="flex-1 sm:flex-initial bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 font-bold py-3 px-6 rounded-xl shadow-lg active:scale-95 transition-all text-xs uppercase tracking-wider"
                        >
                          RETURN TO LOBBY
                        </button>
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              <button
                onClick={handleContinue}
                className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-purple-950/40 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span>Continue Game</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

      </motion.div>
    </div>
  );
}

export default ScoreboardModal;
