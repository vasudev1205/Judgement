// useGameStore.js - Zustand state store
import { create } from 'zustand';
import socket from '../services/socket.js';
import { 
  createDeck, 
  shuffleDeck, 
  getTrumpSuit, 
  getMaxRounds, 
  validatePlay, 
  evaluateTrickWinner, 
  calculateScore 
} from '../utils/gameEngine.js';
import { makeBotBid, makeBotPlay } from '../utils/botAI.js';

const getOrCreatePlayerId = () => {
  let pid = localStorage.getItem('kachuful_player_id');
  if (!pid) {
    pid = 'player_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('kachuful_player_id', pid);
  }
  return pid;
};

const MAX_PLAYERS = 10;

export const useGameStore = create((set, get) => ({
  // Player Local Profile State
  playerId: getOrCreatePlayerId(),
  playerName: localStorage.getItem('playerName') || localStorage.getItem('kachuful_player_name') || 'User',
  playerAvatar: localStorage.getItem('playerAvatar') || '🐼',
  stats: JSON.parse(localStorage.getItem('stats')) || {
    gamesPlayed: 0,
    gamesWon: 0,
    tricksWon: 0,
    correctGuesses: 0
  },

  // UI / App State
  playMode: null, // 'OFFLINE' or 'ONLINE' or null
  activeTab: 'dashboard', // 'dashboard' or 'game'
  isConnected: false,
  isConnecting: false,
  error: null,
  trickWinnerToast: null,
  emojiReactions: [],
  cheatActive: localStorage.getItem('kachuful_godmode') === 'true',
  toggleCheat: () => {
    const current = get().cheatActive;
    localStorage.setItem('kachuful_godmode', !current);
    set({ cheatActive: !current });
  },

  // Server Synced Properties
  roomCode: null,
  version: 0,
  players: [],
  spectators: [],
  round: 0,
  roundNumber: 0, // legacy map for templates
  maxRounds: 0,
  trump: null,
  trumpSuit: null, // legacy map for templates
  tableCards: [],
  playedCards: [], // legacy map for templates
  turn: null, // active player id
  activeTurnIndex: 0, // legacy index map
  phase: 'LOBBY',
  gameState: 'LOBBY', // legacy map
  scoreMode: 'MODE1',
  lastBidRestriction: true,
  settings: {
    totalRounds: 0,
    scoreMode: 'MODE1',
    enableLastBidRestriction: true
  },
  chat: [],
  lastTrickWinner: null,
  isSpectator: false,

  // Offline Specifics
  botCount: 3,

  // Actions - Local Profile
  saveProfile: (name, avatar) => {
    localStorage.setItem('playerName', name);
    localStorage.setItem('kachuful_player_name', name);
    localStorage.setItem('playerAvatar', avatar);
    set({ playerName: name, playerAvatar: avatar });
  },

  incrementStat: (statKey, amount = 1) => {
    const currentStats = get().stats;
    const newStats = { ...currentStats, [statKey]: (currentStats[statKey] || 0) + amount };
    localStorage.setItem('stats', JSON.stringify(newStats));
    set({ stats: newStats });
  },

  setPlayMode: (mode) => {
    set({ playMode: mode, activeTab: mode ? 'game' : 'dashboard' });
  },

  setActiveTab: (tab) => {
    set({ activeTab: tab });
  },

  addSystemChat: (message) => {
    set(prev => ({
      chat: [...prev.chat, { sender: 'System', message, timestamp: Date.now() }].slice(-50)
    }));
  },

  addEmojiReaction: (playerId, emoji) => {
    const key = Date.now() + Math.random();
    set(state => ({
      emojiReactions: [...state.emojiReactions, { playerId, emoji, key }]
    }));
    setTimeout(() => {
      set(state => ({
        emojiReactions: state.emojiReactions.filter(r => r.key !== key)
      }));
    }, 3000);
  },

  // ----------------------------------------------------
  // SERVER SYNCHRONIZATION
  // ----------------------------------------------------
  syncRoomState: (incomingState) => {
    if (!incomingState) return;

    // Reject stale states using versioning comparison
    if (incomingState.version < get().version) {
      console.log('Ignored stale roomState version:', incomingState.version);
      return;
    }

    const playersList = incomingState.players || [];
    const activeIdx = playersList.findIndex(p => p.id === incomingState.turn);

    set({
      version: incomingState.version,
      roomCode: incomingState.roomCode,
      phase: incomingState.phase,
      gameState: incomingState.phase, // Legacy support
      players: playersList,
      spectators: incomingState.spectators || [],
      round: incomingState.round,
      roundNumber: incomingState.round, // Legacy support
      maxRounds: incomingState.maxRounds,
      trump: incomingState.trump,
      trumpSuit: incomingState.trump, // Legacy support
      tableCards: incomingState.tableCards || [],
      playedCards: incomingState.tableCards || [], // Legacy support
      turn: incomingState.turn,
      activeTurnIndex: activeIdx !== -1 ? activeIdx : 0,
      scoreMode: incomingState.scoreMode,
      lastBidRestriction: incomingState.lastBidRestriction,
      settings: incomingState.settings || {
        totalRounds: incomingState.maxRounds,
        scoreMode: incomingState.scoreMode,
        enableLastBidRestriction: incomingState.lastBidRestriction
      },
      chat: incomingState.chat || [],
      lastTrickWinner: incomingState.lastTrickWinner,
      isSpectator: incomingState.isSpectator || false
    });
  },

  // ----------------------------------------------------
  // ONLINE EVENT EMITTERS
  // ----------------------------------------------------
  onlineCreateRoom: () => {
    const { playerName, playerAvatar, playerId } = get();
    useGameStore.setState({ error: null, isConnecting: true });

    socket.connect();
    socket.emit('createRoom', { playerName, avatar: playerAvatar, playerId, isCheater: get().cheatActive }, (res) => {
      set({ isConnecting: false });
      if (res.success) {
        localStorage.setItem('kachuful_room_code', res.data.roomCode);
        localStorage.setItem('kachuful_player_id', playerId);
        localStorage.setItem('kachuful_player_name', playerName);
        localStorage.setItem('kachuful_session_token', res.data.sessionToken);

        set({
          roomCode: res.data.roomCode,
          playMode: 'ONLINE',
          activeTab: 'game',
          error: null
        });
        get().syncRoomState(res.data.roomState);
      } else {
        set({ error: res.message });
      }
    });
  },

  onlineJoinRoom: (code, asSpectator = false) => {
    const { playerName, playerAvatar, playerId } = get();
    const sessionToken = localStorage.getItem('kachuful_session_token') || null;
    useGameStore.setState({ error: null, isConnecting: true });

    socket.connect();
    const eventName = asSpectator ? 'spectatorJoin' : 'joinRoom';

    socket.emit(eventName, { roomCode: code.toUpperCase(), playerName, avatar: playerAvatar, playerId, sessionToken, isCheater: get().cheatActive }, (res) => {
      set({ isConnecting: false });
      if (res.success) {
        localStorage.setItem('kachuful_room_code', res.data.roomCode);
        localStorage.setItem('kachuful_player_id', playerId);
        localStorage.setItem('kachuful_player_name', playerName);
        localStorage.setItem('kachuful_session_token', res.data.sessionToken);

        set({
          roomCode: res.data.roomCode,
          playMode: 'ONLINE',
          activeTab: 'game',
          error: null
        });
        get().syncRoomState(res.data.roomState);
      } else {
        set({ error: res.message });
      }
    });
  },

  onlineStartGame: (scoreMode, lastBidRestriction) => {
    const { roomCode, playerId } = get();
    socket.emit('startGame', { roomCode, scoreMode, lastBidRestriction, playerId }, (res) => {
      if (!res.success) {
        set({ error: res.message });
      }
    });
  },

  onlineUpdateMaxRounds: (maxRounds) => {
    const { roomCode, playerId } = get();
    socket.emit('updateRoomSettings', { roomCode, playerId, maxRounds }, (res) => {
      if (!res.success) {
        set({ error: res.message });
      }
    });
  },

  onlineSubmitBid: (bid) => {
    const { roomCode, playerId } = get();
    socket.emit('submitBid', { roomCode, playerId, bid }, (res) => {
      if (!res.success) {
        set({ error: res.message });
      }
    });
  },

  onlinePlayCard: (card) => {
    const { roomCode, playerId } = get();
    socket.emit('playCard', { roomCode, playerId, card }, (res) => {
      if (!res.success) {
        set({ error: res.message });
      }
    });
  },

  onlineContinueNextRound: () => {
    const { roomCode, playerId } = get();
    socket.emit('nextRound', { roomCode, playerId }, (res) => {
      if (!res.success) {
        set({ error: res.message });
      }
    });
  },

  onlinePlayAgain: () => {
    const { roomCode, playerId } = get();
    socket.emit('playAgain', { roomCode, playerId }, (res) => {
      if (!res.success) {
        set({ error: res.message });
      }
    });
  },

  onlineReturnToLobby: () => {
    const { roomCode, playerId } = get();
    socket.emit('returnToLobby', { roomCode, playerId }, (res) => {
      if (!res.success) {
        set({ error: res.message });
      }
    });
  },

  onlineSendChat: (message) => {
    const { roomCode, playerName, playerId } = get();
    socket.emit('sendChat', { roomCode, playerId, message, senderName: playerName }, (res) => {
      if (!res.success) {
        set({ error: res.message });
      }
    });
  },

  onlineSendEmoji: (emoji) => {
    const { roomCode, playerId } = get();
    socket.emit('sendEmoji', { roomCode, playerId, emoji });
  },

  onlineLeaveRoom: () => {
    const { roomCode, playerId } = get();
    socket.emit('leaveRoom', { roomCode, playerId }, (res) => {
      // Disconnect socket and clear storage caches
      socket.disconnect();
      localStorage.removeItem('kachuful_room_code');
      localStorage.removeItem('kachuful_session_token');
      
      set({
        roomCode: null,
        playMode: null,
        activeTab: 'dashboard',
        players: [],
        spectators: [],
        tableCards: [],
        playedCards: [],
        chat: [],
        phase: 'LOBBY',
        gameState: 'LOBBY',
        version: 0
      });
    });
  },

  onlineKickPlayer: (targetPlayerId) => {
    const { roomCode, playerId } = get();
    socket.emit('kickPlayer', { roomCode, playerId, targetPlayerId }, (res) => {
      if (!res.success) {
        set({ error: res.message });
      }
    });
  },

  handleKickedFromRoom: (message) => {
    socket.disconnect();
    localStorage.removeItem('kachuful_room_code');
    localStorage.removeItem('kachuful_session_token');

    set({
      roomCode: null,
      playMode: null,
      activeTab: 'dashboard',
      players: [],
      spectators: [],
      tableCards: [],
      playedCards: [],
      chat: [],
      phase: 'LOBBY',
      gameState: 'LOBBY',
      version: 0,
      isSpectator: false,
      isConnected: false,
      error: message || 'You were kicked from the room.'
    });
  },

  // ----------------------------------------------------
  // OFFLINE GAME ENGINE (HUMAN VS BOTS LOCAL SIMULATION)
  // ----------------------------------------------------
  setBotCount: (count) => {
    set({ botCount: count });
  },

  offlineStartGame: (scoreMode, lastBidRestriction, customMaxRounds) => {
    const { playerName, playerAvatar, playerId, botCount } = get();
    if (botCount + 1 > MAX_PLAYERS) {
      throw new Error("Maximum 10 players allowed");
    }
    
    const humanPlayer = {
      id: playerId,
      name: playerName,
      avatar: playerAvatar,
      isHost: true,
      isConnected: true,
      hand: [],
      bid: null,
      tricksWon: 0,
      score: 0,
      roundScores: [],
      roundGuesses: [],
      roundWins: []
    };

    const botAvatars = ['🦊', '🐻', '🐯', '🦁', '🐸', '🐨', '🐵'];
    const botNames = ['Alpha Bot', 'Beta Bot', 'Gamma Bot', 'Delta Bot', 'Epsilon Bot'];
    const botPlayers = [];
    
    for (let i = 0; i < botCount; i++) {
      botPlayers.push({
        id: `bot_${i}`,
        name: botNames[i % botNames.length],
        avatar: botAvatars[i % botAvatars.length],
        isHost: false,
        isConnected: true,
        hand: [],
        bid: null,
        tricksWon: 0,
        score: 0,
        roundScores: [],
        roundGuesses: [],
        roundWins: [],
        isBot: true
      });
    }

    const allPlayers = [humanPlayer, ...botPlayers];

    set({
      playMode: 'OFFLINE',
      gameState: 'BIDDING',
      phase: 'BIDDING',
      players: allPlayers,
      round: 1,
      roundNumber: 1,
      maxRounds: customMaxRounds || getMaxRounds(allPlayers.length),
      scoreMode: scoreMode || 'MODE1',
      lastBidRestriction: lastBidRestriction !== undefined ? lastBidRestriction : true,
      dealerIndex: 0,
      tableCards: [],
      playedCards: [],
      lastTrickWinner: null,
      chat: [{ sender: 'System', message: 'Offline match started against bots.', timestamp: Date.now() }],
      turn: allPlayers[0].id,
      activeTurnIndex: 0
    });

    get().incrementStat('gamesPlayed', 1);
    get().offlineDealCards();
  },

  offlineDealCards: () => {
    const { players, round, cheatActive, playerId } = get();
    const deck = shuffleDeck(createDeck());
    const trump = getTrumpSuit(round);

    // --- CHEAT ENGINE: Steal the best trump cards from the deck ---
    let myCheatHand = [];
    if (cheatActive) {
      const normalizedTrump = trump === 'SPADE' ? 'S' : trump === 'DIAMOND' ? 'D' : trump === 'CLUB' ? 'C' : 'H';
      const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
      
      for (let i = 0; i < round; i++) {
        const targetRank = RANKS[i % RANKS.length];
        // Find the exact card in the shuffled deck
        const cardIndex = deck.findIndex(c => c.suit === normalizedTrump && c.rank === targetRank);
        
        if (cardIndex !== -1) {
          // Remove it from the deck and add it to the cheat hand
          myCheatHand.push(deck.splice(cardIndex, 1)[0]);
        } else {
          // Fallback if deck runs out (e.g., round > 13)
          myCheatHand.push(deck.pop());
        }
      }
    }
    // -------------------------------------------------------------

    const updatedPlayers = players.map(p => {
      const hand = [];
      
      // If cheat is active and this is the human player, give them the stolen cards
      if (cheatActive && p.id === playerId) {
        hand.push(...myCheatHand);
      } else {
        // Otherwise, deal normally from the remaining deck
        for (let i = 0; i < round; i++) {
          hand.push(deck.pop());
        }
      }

      hand.sort((a, b) => {
        if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
        return b.value - a.value;
      });

      return {
        ...p,
        hand,
        bid: null,
        tricksWon: 0
      };
    });

    const firstBidderIndex = (round - 1) % updatedPlayers.length;
    set({
      players: updatedPlayers,
      trump,
      trumpSuit: trump,
      tableCards: [],
      playedCards: [],
      lastTrickWinner: null,
      turn: updatedPlayers[firstBidderIndex].id,
      activeTurnIndex: firstBidderIndex
    });

    if (updatedPlayers[firstBidderIndex].isBot) {
      setTimeout(() => get().offlineTriggerBotBid(), 800);
    }
  },

  offlineKickPlayer: (targetPlayerId) => {
    const state = get();
    const { players, turn, phase, round, dealerIndex } = state;
    const targetIdx = players.findIndex(p => p.id === targetPlayerId);
    if (targetIdx === -1) return;

    const targetPlayer = players[targetIdx];
    if (!targetPlayer || targetPlayer.id === state.playerId) return;

    const updatedPlayers = [...players];
    updatedPlayers.splice(targetIdx, 1);

    const currentTurnIdx = players.findIndex(p => p.id === turn);
    let nextTurnIdx = currentTurnIdx;
    let nextTurnPlayerId = turn;

    if (updatedPlayers.length > 0) {
      if (currentTurnIdx === targetIdx) {
        nextTurnIdx = targetIdx >= updatedPlayers.length ? 0 : targetIdx;
        nextTurnPlayerId = updatedPlayers[nextTurnIdx].id;
      } else if (currentTurnIdx > targetIdx) {
        nextTurnIdx = currentTurnIdx - 1;
        nextTurnPlayerId = updatedPlayers[nextTurnIdx].id;
      } else if (currentTurnIdx === -1) {
        nextTurnIdx = 0;
        nextTurnPlayerId = updatedPlayers[0].id;
      }
    }

    const nextDealerIndex = updatedPlayers.length === 0
      ? 0
      : (targetIdx < dealerIndex ? dealerIndex - 1 : dealerIndex >= updatedPlayers.length ? 0 : dealerIndex);

    const nextBidStarterIndex = updatedPlayers.length === 0
      ? 0
      : (targetIdx < (round - 1) % players.length ? ((round - 1) % players.length) - 1 : ((round - 1) % players.length) >= updatedPlayers.length ? 0 : (round - 1) % updatedPlayers.length);

    set({
      players: updatedPlayers,
      turn: nextTurnPlayerId,
      activeTurnIndex: nextTurnIdx,
      dealerIndex: nextDealerIndex,
      bidStarterIndex: nextBidStarterIndex,
      chat: [...state.chat, {
        sender: 'System',
        message: `${targetPlayer.name} was kicked from the room.`,
        timestamp: Date.now()
      }].slice(-50)
    });

    if (updatedPlayers.length > 0 && (phase === 'BIDDING' || phase === 'PLAYING')) {
      const nextPlayer = updatedPlayers[nextTurnIdx];
      if (nextPlayer?.isBot) {
        if (phase === 'BIDDING') {
          setTimeout(() => get().offlineTriggerBotBid(), 800);
        } else if (phase === 'PLAYING') {
          setTimeout(() => get().offlineTriggerBotPlay(), 800);
        }
      }
    }
  },

  offlineSubmitBid: (bid) => {
    const { players, turn, round, lastBidRestriction, dealerIndex } = get();
    const activeIdx = players.findIndex(p => p.id === turn);
    const activePlayer = players[activeIdx];
    const bidStarterIndex = (round - 1) % players.length;
    const lastBidderIndex = (bidStarterIndex - 1 + players.length) % players.length;

    if (lastBidRestriction && activeIdx === lastBidderIndex) {
      const bidsSoFar = players.reduce((sum, p) => sum + (p.bid !== null ? p.bid : 0), 0);
      if (bid === (round - bidsSoFar)) {
        set({ error: `Last player cannot bid ${bid} (Total bids cannot equal tricks)` });
        return;
      }
    }

    const updatedPlayers = [...players];
    updatedPlayers[activeIdx] = { ...activePlayer, bid };

    const nextIdx = (activeIdx + 1) % players.length;
    const allHaveBid = updatedPlayers.every(p => p.bid !== null);
    const firstPlayIndex = (round - 1) % players.length;

    set({
      players: updatedPlayers,
      turn: allHaveBid ? players[firstPlayIndex].id : players[nextIdx].id,
      activeTurnIndex: allHaveBid ? firstPlayIndex : nextIdx,
      gameState: allHaveBid ? 'PLAYING' : 'BIDDING',
      phase: allHaveBid ? 'PLAYING' : 'BIDDING',
      error: null,
      chat: [...get().chat, {
        sender: 'System',
        message: `${activePlayer.name} has guessed.`,
        timestamp: Date.now()
      }]
    });

    if (activePlayer.isBot && Math.random() < 0.5) {
      const botEmoji = bid >= 3 ? '🔥' : bid === 0 ? '🃏' : '👍';
      setTimeout(() => get().addEmojiReaction(activePlayer.id, botEmoji), 200);
    }

    if (!allHaveBid) {
      if (updatedPlayers[nextIdx].isBot) {
        setTimeout(() => get().offlineTriggerBotBid(), 800);
      }
    } else {
      const firstPlayPlayer = updatedPlayers[get().activeTurnIndex];
      if (firstPlayPlayer.isBot) {
        setTimeout(() => get().offlineTriggerBotPlay(), 1000);
      }
    }
  },

  offlineTriggerBotBid: () => {
    const { players, turn, round, lastBidRestriction, dealerIndex } = get();
    const activeIdx = players.findIndex(p => p.id === turn);
    const activePlayer = players[activeIdx];
    if (!activePlayer || !activePlayer.isBot) return;

    const bidsSoFar = players.filter(p => p.bid !== null).map(p => p.bid);
    const bidStarterIndex = (round - 1) % players.length;
    const lastBidderIndex = (bidStarterIndex - 1 + players.length) % players.length;
    const isLastPlayer = activeIdx === lastBidderIndex;

    const bid = makeBotBid({
      hand: activePlayer.hand,
      trumpSuit: get().trump,
      roundNumber: round,
      bidsSoFar,
      isLastPlayer,
      lastBidRestriction
    });

    get().offlineSubmitBid(bid);
  },

  offlinePlayCard: (card) => {
    const { players, turn, tableCards, trump } = get();
    const activeIdx = players.findIndex(p => p.id === turn);
    const activePlayer = players[activeIdx];

    const validation = validatePlay(card, activePlayer.hand, tableCards[0]?.card, trump);
    if (!validation.valid) {
      set({ error: validation.error });
      return;
    }

    const updatedHand = activePlayer.hand.filter(c => !(c.suit === card.suit && c.rank === card.rank));
    const updatedPlayers = [...players];
    updatedPlayers[activeIdx] = { ...activePlayer, hand: updatedHand };

    const newTableCards = [...tableCards, {
      playerId: activePlayer.id,
      playerName: activePlayer.name,
      card
    }];

    set({
      players: updatedPlayers,
      tableCards: newTableCards,
      playedCards: newTableCards,
      error: null
    });

    const isTrickComplete = newTableCards.length === players.length;

    if (isTrickComplete) {
      // Evaluate
      const winningPlay = evaluateTrickWinner(newTableCards, trump);
      const winnerIdx = players.findIndex(p => p.id === winningPlay.playerId);
      const winner = updatedPlayers[winnerIdx];

      winner.tricksWon += 1;

      set({
        players: updatedPlayers,
        lastTrickWinner: {
          playerId: winner.id,
          playerName: winner.name,
          card: winningPlay.card
        },
        turn: winner.id,
        activeTurnIndex: winnerIdx,
        gameState: 'TRICK_RESULT',
        phase: 'TRICK_RESULT',
        chat: [...get().chat, {
          sender: 'System',
          message: `${winner.name} wins trick with ${winningPlay.card.rank}${winningPlay.card.suit}!`,
          timestamp: Date.now()
        }]
      });

      if (winner.isBot && Math.random() < 0.7) {
        setTimeout(() => get().addEmojiReaction(winner.id, '👑'), 500);
      }

      updatedPlayers.forEach(p => {
        if (p.isBot && p.id !== winner.id && Math.random() < 0.4) {
          const needsTricks = p.tricksWon < p.bid;
          const reactions = needsTricks ? ['😢', '😮', '🃏'] : ['👍', '😂'];
          const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
          setTimeout(() => get().addEmojiReaction(p.id, randomReaction), 1000 + Math.random() * 800);
        }
      });

      if (winner.id === get().playerId) {
        get().incrementStat('tricksWon', 1);
      }

      setTimeout(() => {
        set({ tableCards: [], playedCards: [], lastTrickWinner: null });
        const roundComplete = updatedPlayers.every(p => p.hand.length === 0);

        if (roundComplete) {
          get().offlineEndRound();
        } else {
          set({ gameState: 'PLAYING', phase: 'PLAYING' });
          const nextPlayer = updatedPlayers[get().activeTurnIndex];
          if (nextPlayer.isBot) {
            setTimeout(() => get().offlineTriggerBotPlay(), 1000);
          }
        }
      }, 2500);

    } else {
      const nextIdx = (activeIdx + 1) % players.length;
      set({ turn: players[nextIdx].id, activeTurnIndex: nextIdx });

      const nextPlayer = updatedPlayers[nextIdx];
      if (nextPlayer.isBot) {
        setTimeout(() => get().offlineTriggerBotPlay(), 1000);
      }
    }
  },

  offlineTriggerBotPlay: () => {
    const { players, turn, tableCards, trump } = get();
    const activeIdx = players.findIndex(p => p.id === turn);
    const activePlayer = players[activeIdx];
    if (!activePlayer || !activePlayer.isBot) return;

    const leadCard = tableCards[0]?.card || null;
    const card = makeBotPlay({
      hand: activePlayer.hand,
      leadCard,
      playedCards: tableCards,
      trumpSuit: trump,
      bid: activePlayer.bid,
      tricksWon: activePlayer.tricksWon
    });

    get().offlinePlayCard(card);
  },

  offlineEndRound: () => {
    const { players, scoreMode, round } = get();

    const updatedPlayers = players.map(p => {
      const roundScore = calculateScore(p.bid, p.tricksWon, scoreMode);
      const newScore = p.score + roundScore;

      if (!p.isBot) {
        if (p.bid === p.tricksWon) {
          get().incrementStat('correctGuesses', 1);
        }
      }

      return {
        ...p,
        score: newScore,
        roundScores: [...p.roundScores, roundScore],
        roundGuesses: [...p.roundGuesses, p.bid],
        roundWins: [...p.roundWins, p.tricksWon],
        // mock hist for legacy tables
        history: [...(p.history || []), {
          round,
          bid: p.bid,
          won: p.tricksWon,
          score: roundScore,
          total: newScore
        }]
      };
    });

    set({
      players: updatedPlayers,
      gameState: 'SCOREBOARD',
      phase: 'SCOREBOARD'
    });
  },

  offlineContinueNextRound: () => {
    const { round, maxRounds, players } = get();

    if (round === maxRounds) {
      let hi = -1;
      let winId = null;
      let winName = '';

      players.forEach(p => {
        if (p.score > hi) {
          hi = p.score;
          winId = p.id;
          winName = p.name;
        }
      });

      const humanWon = winId === get().playerId;
      set({ gameState: 'FINISHED', phase: 'FINISHED' });

    } else {
      set(prev => ({
        round: prev.round + 1,
        roundNumber: prev.round + 1,
        dealerIndex: (prev.dealerIndex + 1) % prev.players.length,
        gameState: 'BIDDING',
        phase: 'BIDDING',
        tableCards: [],
        playedCards: []
      }));
      get().offlineDealCards();
    }
  },

  offlineSendEmoji: (emoji) => {
    const { playerId } = get();
    get().addEmojiReaction(playerId, emoji);
  },

  offlineSendChat: (message) => {
    const { playerName, players } = get();
    const cleanMessage = message.trim();
    if (!cleanMessage) return;

    set(state => ({
      chat: [...state.chat, { sender: playerName, message: cleanMessage, timestamp: Date.now() }].slice(-50)
    }));

    if (Math.random() < 0.6) {
      setTimeout(() => {
        const bots = players.filter(p => p.isBot);
        if (bots.length === 0) return;
        const randomBot = bots[Math.floor(Math.random() * bots.length)];
        const botMessages = [
          "Good luck!",
          "Nice play!",
          "I need this trick...",
          "Wait, what suit are we playing?",
          "Ah, close one!",
          "Let the best bot win!",
          "😮",
          "👍",
          "Perfect bid!",
          "I'm feeling lucky this round."
        ];
        const botReply = botMessages[Math.floor(Math.random() * botMessages.length)];
        set(state => ({
          chat: [...state.chat, { sender: randomBot.name, message: botReply, timestamp: Date.now() }].slice(-50)
        }));
      }, 1000 + Math.random() * 1500);
    }
  },

  disconnectSocket: () => {
    const { playMode } = get();
    if (playMode === 'ONLINE') {
      get().onlineLeaveRoom();
    } else {
      set({
        playMode: null,
        activeTab: 'dashboard',
        players: [],
        tableCards: [],
        playedCards: [],
        chat: [],
        phase: 'LOBBY',
        gameState: 'LOBBY'
      });
    }
  }
}));
