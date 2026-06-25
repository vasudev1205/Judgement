import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../store/useGameStore.js';
import { SUIT_SYMBOLS, SUIT_NAMES, validatePlay } from '../utils/gameEngine.js';
import { MessageSquare, Send, Trophy, Smile, HelpCircle, X, Shield, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ScoreboardModal from './ScoreboardModal.jsx';
import GameLobby from './GameLobby.jsx';

function GameTable() {
  const {
    playMode,
    gameState,
    phase,
    players,
    spectators,
    roundNumber,
    maxRounds,
    trumpSuit,
    scoreMode,
    lastBidRestriction,
    playedCards,
    dealerIndex,
    activeTurnIndex,
    chat,
    lastTrickWinner,
    playerId,
    isSpectator,
    roomCode,
    emojiReactions,
    trickWinnerToast,
    error,
    onlinePlayCard,
    offlinePlayCard,
    onlineSubmitBid,
    offlineSubmitBid,
    onlineKickPlayer,
    offlineKickPlayer,
    onlineSendChat,
    offlineSendChat,
    onlineSendEmoji,
    offlineSendEmoji,
    disconnectSocket
  } = useGameStore();

  const trumpSuitShort = trumpSuit && trumpSuit.length > 1 ? (
    trumpSuit === 'SPADE' ? 'S' : trumpSuit === 'DIAMOND' ? 'D' : trumpSuit === 'CLUB' ? 'C' : 'H'
  ) : trumpSuit;

  const [chatMessage, setChatMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMyHand, setShowMyHand] = useState(true);
  const chatEndRef = useRef(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [localRuleHint, setLocalRuleHint] = useState('');

  // Determine local human index in players list
  const playersList = players || [];
  // Determine local human index in players list
  const humanSeatIndex = playersList.findIndex(p => p.id === playerId);
  const me = playersList.find(p => p.id === playerId);
  const isHost = me?.isHost;
  const isMyTurn = playMode === 'ONLINE' ? (me ? me.isMyTurn : false) : (activeTurnIndex === humanSeatIndex);

  // Reorder players list so the human is always at index 0 (visual bottom of the circular table)
  let orderedSeats = [];
  if (playersList.length > 0) {
    if (humanSeatIndex !== -1) {
      orderedSeats = [...playersList.slice(humanSeatIndex), ...playersList.slice(0, humanSeatIndex)];
    } else {
      orderedSeats = [...playersList];
    }
  }
  const myHand = playersList[humanSeatIndex]?.hand || [];
  const leadCard = playedCards?.[0]?.card || null;
  const mustFollowSuit = !!leadCard && myHand.some((c) => c.suit === leadCard.suit);

  const getBiddingStartIndex = (round, playerCount) => {
    if (!playerCount) return 0;
    return (round - 1) % playerCount;
  };

  const getLastBidderIndex = (round, playerCount) => {
    if (!playerCount) return 0;
    const startIndex = getBiddingStartIndex(round, playerCount);
    return (startIndex - 1 + playerCount) % playerCount;
  };

  const isCardPlayable = (card) => {
    if (!card) return false;
    if (phase !== 'PLAYING' || !isMyTurn) return false;
    const validation = validatePlay(card, myHand, leadCard, trumpSuitShort);
    return validation.valid;
  };

  // Clear card selection when turn, phase or chat changes
  useEffect(() => {
    setSelectedCard(null);
    setLocalRuleHint('');
  }, [phase, isMyTurn, chat, playedCards]);

  useEffect(() => {
    if (!showMyHand) {
      setSelectedCard(null);
    }
  }, [showMyHand]);

  const getCardSuitColorClass = (suit) => {
    return (suit === 'H' || suit === 'D') ? 'text-red-600' : 'text-slate-950';
  };

  const handleCardClick = (card) => {
    if (phase !== 'PLAYING' || !isMyTurn) return;
    if (!isCardPlayable(card)) {
      if (mustFollowSuit && leadCard) {
        setLocalRuleHint(`You must follow lead suit: ${SUIT_NAMES[leadCard.suit]} (${SUIT_SYMBOLS[leadCard.suit]}).`);
      }
      return;
    }
    setLocalRuleHint('');
    
    if (selectedCard && selectedCard.rank === card.rank && selectedCard.suit === card.suit) {
      handlePlayCard(card);
      setSelectedCard(null);
    } else {
      setSelectedCard(card);
    }
  };

  const handleKickPlayer = (targetPlayer) => {
    if (!isHost || !targetPlayer || targetPlayer.id === playerId) return;
    const confirmed = window.confirm(`Kick ${targetPlayer.name} from the room?`);
    if (!confirmed) return;

    if (playMode === 'ONLINE') {
      onlineKickPlayer(targetPlayer.id);
    } else {
      offlineKickPlayer(targetPlayer.id);
    }
  };

  // Auto-scroll chat to bottom when new messages arrive
  // useEffect(() => {
  //   chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  // }, [chat]);

  // Handle playing card
  const handlePlayCard = (card) => {
    if (phase !== 'PLAYING' || !isMyTurn) return;
    if (!isCardPlayable(card)) return;
    if (playMode === 'ONLINE') {
      onlinePlayCard(card);
    } else {
      offlinePlayCard(card);
    }
  };

  // Handle submitting bid
  const handleSelectBid = (bid) => {
    if (phase !== 'BIDDING' || !isMyTurn) return;
    if (playMode === 'ONLINE') {
      onlineSubmitBid(bid);
    } else {
      offlineSubmitBid(bid);
    }
  };

  // Handle chat submission
  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    if (playMode === 'ONLINE') {
      onlineSendChat(chatMessage.trim());
    } else {
      offlineSendChat(chatMessage.trim());
    }
    setChatMessage('');
  };

  // Handle emoji trigger
  const handleSendEmoji = (emoji) => {
    if (playMode === 'ONLINE') {
      onlineSendEmoji(emoji);
    } else {
      offlineSendEmoji(emoji);
    }
    setShowEmojiPicker(false);
  };

  // Calculate the forbidden bid for the last bidding player (only if restriction enabled)
  const getForbiddenBid = () => {
    if (playMode === 'ONLINE') return null; // Server handles/sends allowedBids list
    if (!lastBidRestriction || phase !== 'BIDDING') return null;

    const lastBidderIndex = getLastBidderIndex(roundNumber, playersList.length);
    if (activeTurnIndex !== lastBidderIndex) return null;

    const totalBidsSoFar = players.reduce((sum, p) => sum + (p.bid !== null ? (p.bid >= 0 ? p.bid : 0) : 0), 0);
    const forbidden = roundNumber - totalBidsSoFar;
    return forbidden >= 0 && forbidden <= roundNumber ? forbidden : null;
  };

  const forbiddenBid = getForbiddenBid();

  // Helper to resolve CSS colors based on card suit symbols
  const getSuitColorClass = (suit) => {
    switch (suit) {
      case 'H': return 'suit-red';
      case 'D': return 'suit-yellow';
      case 'C': return 'suit-green';
      default: return 'suit-black';
    }
  };

  if (playMode === 'ONLINE' && (!roomCode || !players || players.length === 0)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f111a] text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500 mb-4"></div>
        <div className="text-sm font-semibold text-slate-400">Loading Game...</div>
      </div>
    );
  }

  if (playMode === 'ONLINE' && phase === 'LOBBY') {
    return <GameLobby />;
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col md:flex-row bg-[#0f111a] text-slate-100 overflow-hidden">
      
      {/* Game Table Board Section */}
      <div className="flex-1 relative flex flex-col items-center justify-between p-4 min-h-[85vh] md:min-h-screen">
        
        {/* Top HUD */}
        <div className="w-full flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={disconnectSocket}
              className="bg-slate-900/60 hover:bg-slate-800 border border-white/5 py-2 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              &larr; Exit
            </button>
            <div className="hidden sm:block text-xs bg-slate-900/40 border border-white/5 px-3 py-1.5 rounded-xl font-medium">
              Mode: <span className="text-purple-400 font-bold">{playMode}</span>
            </div>
            {playMode === 'ONLINE' && (
              <div className="text-xs bg-purple-950/20 border border-purple-500/20 text-purple-400 px-3 py-1.5 rounded-xl font-bold">
                Room: {roomCode}
              </div>
            )}
          </div>

          {/* Trump and Round Info Board */}
          <div className="flex items-center gap-4">
            <div className="text-center bg-slate-900/60 border border-white/5 rounded-2xl px-4 py-2 flex items-center gap-3">
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Trump</div>
                 <div className={`text-xl font-bold flex items-center justify-center gap-1 ${getSuitColorClass(trumpSuitShort)}`}>
                  <span className="text-2xl">{SUIT_SYMBOLS[trumpSuitShort]}</span>
                  <span className="text-xs text-white hidden xs:inline">{SUIT_NAMES[trumpSuitShort]}</span>
                </div>
              </div>
              <div className="border-l border-white/10 h-8"></div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Round</div>
                <div className="text-sm font-extrabold text-white text-center">
                  {roundNumber} <span className="text-slate-400 font-normal">/ {maxRounds}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Strong turn indicator for the active user */}
        {!isSpectator && isMyTurn && (phase === 'BIDDING' || phase === 'PLAYING') && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="mt-3 px-5 py-2.5 rounded-2xl border border-emerald-300/40 bg-emerald-500/15 text-emerald-200 shadow-[0_0_28px_rgba(16,185,129,0.35)]"
          >
            <div className="text-sm font-extrabold tracking-wide uppercase text-center">
              {phase === 'BIDDING' ? 'Your Turn: Place Bid' : 'Your Turn: Play A Card'}
            </div>
          </motion.div>
        )}

        {/* Circular Arena Table Area */}
        <div className="flex-1 w-full flex items-center justify-center relative my-4">
          
          {/* Table container wrapper (forced square using vmin metrics for perfect responsive scaling) */}
          <div className="relative w-[85vmin] h-[85vmin] max-w-[560px] max-h-[560px] flex items-center justify-center">
            
            {/* Table Background Circle */}
            <div className="w-[66%] h-[66%] rounded-full border-4 border-slate-800 bg-gradient-to-tr from-slate-900 to-[#1e233d] shadow-[0_0_80px_rgba(30,35,61,0.5),inset_0_0_50px_rgba(0,0,0,0.8)] relative flex items-center justify-center">
              
              {/* Center Area Cards in Play */}
              <div className="relative w-36 h-36 flex items-center justify-center">
                {/* Show Trump Glow in center */}
                <div className="absolute inset-0 bg-purple-500/5 rounded-full blur-2xl -z-10 animate-pulse-subtle"></div>
                
                <AnimatePresence>
                  {(playedCards || []).map((play, idx) => {
                    // Find angle position of the player who played this card to float it from their direction
                    const seatIdx = orderedSeats.findIndex(s => s.id === play.playerId);
                    const total = orderedSeats.length;
                    const angleDeg = (360 / total) * seatIdx;
                    const angle = ((angleDeg + 90) * Math.PI) / 180;
                    
                    const isLargeRoom = total > 6;
                    const cardWidth = isLargeRoom ? 'w-[45px]' : 'w-[60px]';
                    const cardHeight = isLargeRoom ? 'h-[65px]' : 'h-[85px]';
                    const cardRadius = isLargeRoom ? 'rounded-[8px]' : 'rounded-[10px]';
                    const centerOffset = isLargeRoom ? 32 : 45;
                    const animDistance = isLargeRoom ? 80 : 120;
                    
                    // Small offset coordinates towards the center
                    const offsetX = Math.cos(angle) * centerOffset;
                    const offsetY = Math.sin(angle) * centerOffset;

                    return (
                      <motion.div
                        key={`${play.playerId}-${play.card.rank}${play.card.suit}`}
                        initial={{ scale: 0, x: Math.cos(angle) * animDistance, y: Math.sin(angle) * animDistance, opacity: 0 }}
                        animate={{ scale: 1, x: offsetX, y: offsetY, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                        className={`absolute ${cardWidth} ${cardHeight} ${cardRadius} bg-white border-2 border-[#222] shadow-lg flex flex-col justify-between p-1 select-none ${getCardSuitColorClass(play.card.suit)}`}
                      >
                        {/* Top Left */}
                        <div className="flex flex-col items-center absolute top-0.5 left-1 leading-none">
                          <span className={`${isLargeRoom ? 'text-[7px]' : 'text-[9px]'} font-black`}>{play.card.rank}</span>
                          <span className={`${isLargeRoom ? 'text-[8px]' : 'text-[10px]'}`}>{SUIT_SYMBOLS[play.card.suit]}</span>
                        </div>

                        {/* Center */}
                        <div className="flex flex-col items-center justify-center h-full w-full">
                          <span className={`${isLargeRoom ? 'text-xs' : 'text-base'} font-extrabold leading-none`}>{play.card.rank}</span>
                          <span className={`${isLargeRoom ? 'text-sm' : 'text-lg'} leading-none mt-0.5`}>{SUIT_SYMBOLS[play.card.suit]}</span>
                        </div>

                        {/* Bottom Right */}
                        <div className="flex flex-col items-center absolute bottom-0.5 right-1 leading-none rotate-180">
                          <span className={`${isLargeRoom ? 'text-[7px]' : 'text-[9px]'} font-black`}>{play.card.rank}</span>
                          <span className={`${isLargeRoom ? 'text-[8px]' : 'text-[10px]'}`}>{SUIT_SYMBOLS[play.card.suit]}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* Played Cards Label (Trick detail) */}
                {playedCards.length === 0 && lastTrickWinner && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-slate-950/80 border border-purple-500/20 py-2 px-3 rounded-xl text-center text-xs w-48 shadow-lg shadow-black/50"
                  >
                    <div className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider">Trick Winner</div>
                    <div className="font-bold text-white mt-0.5 truncate">{lastTrickWinner.playerName}</div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1 mt-0.5">
                      <span>Won with</span>
                      <span className={getSuitColorClass(lastTrickWinner.card.suit)}>{lastTrickWinner.card.rank}{SUIT_SYMBOLS[lastTrickWinner.card.suit]}</span>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Seat Avatars arranged circularly */}
            {orderedSeats.map((player, idx) => {
              const total = orderedSeats.length || 1;
              const angleDeg = (360 / total) * idx;
              const angleRad = ((angleDeg + 90) * Math.PI) / 180;
              
              // Absolute positioning percentages on the circular container
              const r = 43; // Radius percentage (placed cleanly outside the 33% radius table ring)
              const left = 50 + r * Math.cos(angleRad);
              const top = 50 + r * Math.sin(angleRad);

              const isCurrentDealer = playersList.findIndex(p => p.id === player.id) === dealerIndex;
              const isCurrentActiveTurn = playersList.findIndex(p => p.id === player.id) === activeTurnIndex;
              const hasGuessed = player.guessSubmitted;
              const isMe = player.id === playerId;

              // Find if there are floating emojis for this player
              const activeReactions = emojiReactions.filter(r => r.playerId === player.id);

              // Scale elements dynamically based on player count
              let avatarSize = 'w-14 h-14 text-2xl';
              let nameSize = 'text-[11px]';
              let hudSize = 'text-[9px] px-2 py-0.5';
              let nameMaxW = 'max-w-[75px]';
              
              if (total <= 4) {
                avatarSize = 'w-16 h-16 text-3xl';
                nameSize = 'text-xs';
                hudSize = 'text-[10px] px-2 py-0.5';
                nameMaxW = 'max-w-[90px]';
              } else if (total >= 8) {
                avatarSize = 'w-11 h-11 text-lg';
                nameSize = 'text-[9px]';
                hudSize = 'text-[8px] px-1 py-0.5';
                nameMaxW = 'max-w-[60px]';
              }

              return (
                <div
                  key={player.id}
                  style={{ left: `${left}%`, top: `${top}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 group"
                >
                  {isHost && player.id !== playerId && (
                    <button
                      onClick={() => handleKickPlayer(player)}
                      className="absolute -top-3 right-0 z-40 w-7 h-7 rounded-full bg-red-500/90 border border-red-300/20 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      title={`Kick ${player.name}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Floating Emojis */}
                  <AnimatePresence>
                    {activeReactions.map(react => (
                      <span 
                        key={react.key} 
                        className="absolute -top-12 text-3xl emoji-floater select-none z-50 pointer-events-none"
                      >
                        {react.emoji}
                      </span>
                    ))}
                  </AnimatePresence>

                  {/* Avatar ring (Glows if current turn) */}
                  <div 
                    className={`${avatarSize} rounded-full flex items-center justify-center shadow-xl transition-all relative border-2 ${
                      isCurrentActiveTurn
                        ? 'bg-purple-600/30 border-purple-500 ring-4 ring-purple-500/20 scale-110 shadow-purple-500/30'
                        : isMe 
                          ? 'bg-slate-900 border-indigo-400'
                          : 'bg-slate-900 border-white/10 hover:border-white/20'
                    }`}
                  >
                          <div className="flex flex-col items-center justify-center leading-none gap-0.5">
                            <span className="text-[15px] font-extrabold text-white/90 tabular-nums px-1.5 py-0.5 rounded-full bg-slate-950/80 border border-white/10">
                              {player.score}
                            </span>
                            <span className="leading-none">{player.avatar}</span>
                          </div>
                    
                    {/* Connection indicator */}
                    {!player.isConnected && (
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 border-2 border-slate-950 rounded-full flex items-center justify-center text-[8px] font-black text-white" title="Disconnected">
                        !
                      </span>
                    )}

                    {/* Dealer Icon */}
                    {isCurrentDealer && (
                      <span 
                        className="absolute -bottom-1 -right-1 w-5 h-5 bg-yellow-500 text-slate-950 rounded-full flex items-center justify-center text-[10px] font-black shadow"
                        title="First Play"
                      >
                        F
                      </span>
                    )}
                  </div>

                  {/* Name / Bid HUD */}
                  <div className="mt-2 text-center">
                    <div className={`${nameSize} font-bold text-white truncate ${nameMaxW}`}>
                      {player.name}
                    </div>
                    
                    <div className={`flex items-center justify-center mt-0.5 bg-slate-950/60 border border-white/5 rounded-full ${hudSize}`}>
                      <span className="text-slate-400 font-medium mr-1.5"></span>
                      <span className="text-emerald-400 font-extrabold tabular-nums">
                        {phase === 'BIDDING'
                          ? `${player.tricksWon}/${hasGuessed ? player.bid : '...'}`
                          : `${player.tricksWon}/${player.bid >= 0 ? player.bid : 'N/A'}`}
                      </span>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Human Action Phase Interface (Bid dials or card deck) */}
        <div className="w-full flex flex-col items-center z-30">
          
          {/* 1. Bid selection dials (Guess Phase) */}
          {phase === 'BIDDING' && isMyTurn && !isSpectator && (
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="glass-panel p-5 rounded-3xl border-purple-500/20 max-w-lg w-full flex flex-col items-center mb-4"
            >
              <div className="text-xs text-purple-400 font-bold uppercase tracking-wider mb-3">Place Your Forecast Bid</div>
              
              <div className="flex flex-wrap justify-center gap-2">
                {Array.from({ length: roundNumber + 1 }).map((_, val) => {
                  const allowedBids = me ? me.allowedBids : [];
                  const isForbidden = playMode === 'ONLINE' ? !allowedBids.includes(val) : (forbiddenBid === val);
                  return (
                    <button
                      key={val}
                      onClick={() => handleSelectBid(val)}
                      disabled={isForbidden}
                      className={`w-11 h-11 rounded-xl text-sm font-extrabold transition-all border flex items-center justify-center ${
                        isForbidden 
                          ? 'bg-slate-900 border-red-500/10 text-red-500/40 cursor-not-allowed'
                          : 'bg-slate-900 hover:bg-purple-600 border-white/10 hover:border-purple-400 text-white hover:scale-105 active:scale-95'
                      }`}
                      title={isForbidden ? 'Last bid restriction applies: total bids cannot equal round tricks.' : ''}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>

              {playMode === 'OFFLINE' && forbiddenBid !== null && (
                <div className="text-[10px] text-red-400 font-semibold mt-3 flex items-center gap-1 bg-red-950/20 py-1 px-3 rounded-full border border-red-900/30">
                  <span>⚠️</span>
                  <span>Last Bid Restriction: You cannot guess <strong>{forbiddenBid}</strong></span>
                </div>
              )}

              {playMode === 'ONLINE' && me && me.allowedBids.length < (roundNumber + 1) && (
                <div className="text-[10px] text-red-400 font-semibold mt-3 flex items-center gap-1 bg-red-950/20 py-1 px-3 rounded-full border border-red-900/30">
                  <span>⚠️</span>
                  <span>Last Bid Restriction applies (one bid is disabled)</span>
                </div>
              )}
            </motion.div>
          )}

          {/* 2. Interactive Card Deck hand */}
          {/* 2. Interactive Card Deck hand */}
          {(!isSpectator && myHand.length > 0) && (
            <div className="w-full max-w-3xl flex flex-col items-center">
              
              {/* Hand cards count & turn status */}
              <div className="text-xs text-slate-400 font-semibold flex items-center gap-3 mb-2">
                <span>Your Hand ({myHand.length} Cards)</span>
                {phase === 'PLAYING' && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isMyTurn ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30 animate-pulse' : 'bg-slate-900 text-slate-500 border border-white/5'
                  }`}>
                    {isMyTurn ? 'Your Turn to Play' : 'Waiting for opponent...'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowMyHand(v => !v)}
                  className="ml-auto px-3 py-1 rounded-full bg-slate-900/80 border border-white/10 text-[10px] font-bold text-slate-200 hover:border-purple-400/40 hover:text-white transition-colors"
                >
                  {showMyHand ? 'Hide Cards' : 'Show Cards'}
                </button>
              </div>

              {phase === 'PLAYING' && isMyTurn && mustFollowSuit && leadCard && (
                <div className="mb-2 text-[11px] font-semibold text-amber-200 bg-amber-500/10 border border-amber-400/25 rounded-lg px-3 py-1.5">
                  Lead suit is {SUIT_NAMES[leadCard.suit]} ({SUIT_SYMBOLS[leadCard.suit]}). Play a {SUIT_SYMBOLS[leadCard.suit]} card.
                </div>
              )}

              {(localRuleHint || error) && phase === 'PLAYING' && isMyTurn && (
                <div className="mb-2 text-[11px] font-semibold text-red-200 bg-red-500/10 border border-red-400/25 rounded-lg px-3 py-1.5">
                  {localRuleHint || error}
                </div>
              )}

              {/* Spacing optimization based on hand size */}
              <div 
                className="w-full overflow-x-auto overflow-y-hidden py-6 select-none scrollbar-thin" 
                style={{ 
                  paddingLeft: 'max(20px, env(safe-area-inset-left))', 
                  paddingRight: 'max(20px, env(safe-area-inset-right))' 
                }}
              >
                <div className="flex items-center justify-start sm:justify-center min-w-max mx-auto px-4">
                  {myHand.map((card, idx) => {
                    const isSelected = selectedCard && selectedCard.rank === card.rank && selectedCard.suit === card.suit;
                    const totalCards = myHand.length;
                    const cardPlayable = isCardPlayable(card);
                    const canInteract = phase === 'PLAYING' && isMyTurn && cardPlayable;
                    
                    // Card Fan spacing rules:
                    // 1-4 cards: Normal spacing (12px gap)
                    // 5-7 cards: Reduce overlap slightly (-24px overlap)
                    // 8-10 cards: Use compact spacing (-48px overlap)
                    let marginStyle = {};
                    if (idx > 0) {
                      if (totalCards >= 5 && totalCards <= 7) {
                        marginStyle = { marginLeft: '-24px' };
                      } else if (totalCards >= 8) {
                        marginStyle = { marginLeft: '-48px' };
                      } else {
                        marginStyle = { marginLeft: '12px' };
                      }
                    }

                    return (
                      <button
                        key={`${card.rank}-${card.suit}`}
                        onClick={() => handleCardClick(card)}
                        disabled={!showMyHand || !canInteract}
                        title={!canInteract && phase === 'PLAYING' && isMyTurn && mustFollowSuit && leadCard && card.suit !== leadCard.suit
                          ? `Must follow ${SUIT_NAMES[leadCard.suit]} (${SUIT_SYMBOLS[leadCard.suit]})`
                          : ''}
                        style={{
                          ...marginStyle,
                          transform: isSelected ? 'translateY(-30px) scale(1.05)' : undefined,
                          zIndex: isSelected ? 50 : idx + 5
                        }}
                        className={`relative w-[90px] h-[130px] flex-shrink-0 rounded-[18px] bg-white border-2 flex flex-col justify-between p-2 select-none transition-all duration-200 transform-gpu
                          ${getCardSuitColorClass(card.suit)}
                          ${isSelected 
                            ? 'border-purple-600 shadow-[0_0_24px_rgba(139,92,246,0.8)]' 
                            : 'border-[#222] shadow-[0_8px_24px_rgba(0,0,0,0.25)]'
                          }
                          ${canInteract
                            ? 'hover:-translate-y-5 hover:scale-[1.08] hover:shadow-[0_0_20px_rgba(139,92,246,0.6)] cursor-pointer hover:z-[60]' 
                            : 'opacity-60 cursor-not-allowed'
                          }
                          ${(phase === 'PLAYING' && isMyTurn && !cardPlayable)
                            ? 'grayscale-[0.25] border-amber-500/40'
                            : ''
                          }
                          ${!showMyHand ? 'border-dashed border-slate-600 bg-slate-900 text-slate-500' : ''}
                        `}
                      >
                        {showMyHand ? (
                          <>
                            {/* Top Left corner */}
                            <div className="flex flex-col items-center absolute top-2 left-2.5 leading-none">
                              <span className="text-xs sm:text-sm font-black">{card.rank}</span>
                              <span className="text-sm sm:text-base mt-0.5">{SUIT_SYMBOLS[card.suit]}</span>
                            </div>

                            {/* Center value */}
                            <div className="flex flex-col items-center justify-center h-full w-full">
                              <span className="text-3xl sm:text-4xl font-extrabold leading-none">{card.rank}</span>
                              <span className="text-4xl sm:text-5xl leading-none mt-1">{SUIT_SYMBOLS[card.suit]}</span>
                            </div>

                            {/* Bottom Right corner (rotated 180) */}
                            <div className="flex flex-col items-center absolute bottom-2 right-2.5 leading-none rotate-180">
                              <span className="text-xs sm:text-sm font-black">{card.rank}</span>
                              <span className="text-sm sm:text-base mt-0.5">{SUIT_SYMBOLS[card.suit]}</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full w-full text-slate-300">
                            <span className="text-3xl leading-none">🂠</span>
                            <span className="text-[10px] font-bold mt-2 tracking-wider uppercase">Hidden</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Floating Emoji Picker Trigger */}
      {!isSpectator && (
        <div className="fixed bottom-6 right-6 z-40">
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="w-12 h-12 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl flex items-center justify-center text-xl text-slate-300 hover:text-white transition-all shadow-xl active:scale-95"
            >
              <Smile className="w-5.5 h-5.5" />
            </button>

            <AnimatePresence>
              {showEmojiPicker && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  className="absolute bottom-14 right-0 bg-slate-900/95 border border-white/10 backdrop-blur-md p-3 rounded-2xl shadow-2xl flex gap-2 w-max"
                >
                  {['👍', '😂', '🔥', '😮', '😢', '👑', '🃏'].map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => handleSendEmoji(emoji)}
                      className="text-2xl hover:scale-125 active:scale-95 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Sidebar Chat System */}
      <div className={`fixed inset-y-0 right-0 z-40 w-80 bg-slate-950/95 border-l border-white/5 backdrop-blur-lg flex flex-col justify-between transform transition-transform duration-300 md:relative md:translate-x-0 ${
        showChat ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Toggle Chat button (mobile overlay) */}
        <button
          onClick={() => setShowChat(!showChat)}
          className="absolute left-[-56px] top-6 w-11 h-11 bg-slate-900 border border-white/5 border-r-0 rounded-l-2xl flex items-center justify-center text-slate-300 md:hidden shadow-lg shadow-black/50"
        >
          <MessageSquare className="w-5 h-5" />
        </button>

        {/* Chat Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-white text-sm">
            <MessageSquare className="w-4 h-4 text-purple-400" />
            <span>In-game Chat Log</span>
          </div>
          <span className="text-[10px] bg-slate-900 border border-white/5 px-2 py-0.5 rounded text-slate-400 font-bold uppercase">
            {(chat || []).length} Logged
          </span>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {(chat || []).map((msg, idx) => {
            const isSystem = msg.sender === 'System';
            return (
              <div 
                key={idx} 
                className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                  isSystem 
                    ? 'bg-purple-950/15 border border-purple-900/10 text-purple-300' 
                    : 'bg-slate-900/50 border border-white/5 text-slate-300'
                }`}
              >
                {!isSystem && (
                  <span className="font-extrabold text-white block mb-0.5">
                    {msg.sender}
                  </span>
                )}
                <span>{msg.message}</span>
              </div>
            );
          })}
          <div ref={chatEndRef}></div>
        </div>

        {/* Input area */}
        <form onSubmit={handleSendChat} className="p-4 border-t border-white/5 flex gap-2">
          <input
            type="text"
            placeholder="Type message..."
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            maxLength={100}
            className="flex-1 glass-input py-2 px-3 rounded-xl text-xs"
          />
          <button
            type="submit"
            className="bg-purple-600 hover:bg-purple-500 text-white p-2.5 rounded-xl shadow active:scale-95 transition-transform"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* Scoreboard Overlay Trigger */}
      {(phase === 'SCOREBOARD' || phase === 'FINISHED') && (
        <ScoreboardModal />
      )}

      {/* Center Trick Winner Visual Banner Notification */}
      <AnimatePresence>
        {trickWinnerToast && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="bg-slate-950/95 border-2 border-purple-500/30 p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-2 max-w-sm text-center">
              <span className="text-4xl">🏆</span>
              <h4 className="text-base font-extrabold text-white">Trick Won</h4>
              <p className="text-xs text-purple-300">
                <strong>{trickWinnerToast.winnerName}</strong> wins the trick with:
              </p>
              <div className="bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-xl font-bold flex items-center gap-2 mt-1">
                <span className={getSuitColorClass(trickWinnerToast.card.suit)}>
                  {trickWinnerToast.card.rank}{SUIT_SYMBOLS[trickWinnerToast.card.suit]}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default GameTable;
