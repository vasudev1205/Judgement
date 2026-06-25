// RoomManager.js - Singleton Room Manager
import crypto from 'crypto';

const MAX_PLAYERS = 10;

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  // Generate room code (Uppercase alphabetical only, length driven by env)
  generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const length = parseInt(process.env.ROOM_CODE_LENGTH) || 3;
    let code;
    do {
      code = '';
      for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms.has(code));
    return code;
  }

  // Create new room
  createRoom(playerName, avatar, playerId, socketId) {
    const code = this.generateRoomCode();
    const sessionToken = crypto.randomUUID();

    const room = {
      roomCode: code,
      version: 1,
      locked: false,
      players: [
        {
          id: playerId,
          name: playerName,
          avatar: avatar,
          socketId: socketId,
          isConnected: true,
          sessionToken: sessionToken,
          isHost: true,
          hand: [],
          bid: null,
          tricksWon: 0,
          score: 0,
          roundScores: [],
          roundGuesses: [],
          roundWins: []
        }
      ],
      spectators: [],
      deck: [],
      round: 0,
      maxRounds: 0,
      trump: null,
      tableCards: [], // array of { playerId, card }
      turn: null, // playerId of active player
      phase: 'LOBBY', // LOBBY, DEALING, BIDDING, PLAYING, TRICK_RESULT, SCOREBOARD, FINISHED
      scoreMode: 'MODE1', // MODE1 or MODE2
      lastBidRestriction: true,
      settings: {
        totalRounds: 0,
        scoreMode: 'MODE1',
        enableLastBidRestriction: true
      },
      chat: [],
      lastTrickWinner: null,
      dealerIndex: 0,
      bidStarterIndex: 0,
      disconnectTimeouts: {} // playerId -> timeout mapping
    };

    this.rooms.set(code, room);
    return { room, sessionToken };
  }

  // Get Room
  getRoom(roomCode) {
    if (!roomCode) return null;
    return this.rooms.get(roomCode.toUpperCase());
  }

  // Delete Room
  deleteRoom(roomCode) {
    return this.rooms.delete(roomCode.toUpperCase());
  }

  // Join Room as player
  joinRoom(room, playerName, avatar, playerId, socketId) {
    if (room.players.length >= MAX_PLAYERS) {
      throw new Error("Maximum 10 players allowed");
    }
    const sessionToken = crypto.randomUUID();
    const playerObj = {
      id: playerId,
      name: playerName,
      avatar: avatar,
      socketId: socketId,
      isConnected: true,
      sessionToken: sessionToken,
      isHost: false,
      hand: [],
      bid: null,
      tricksWon: 0,
      score: 0,
      roundScores: [],
      roundGuesses: [],
      roundWins: []
    };

    room.players.push(playerObj);
    return sessionToken;
  }

  // Join Room as spectator
  joinSpectator(room, playerName, avatar, playerId, socketId) {
    const sessionToken = crypto.randomUUID();
    const spectatorObj = {
      id: playerId,
      name: playerName,
      avatar: avatar,
      socketId: socketId,
      isConnected: true,
      sessionToken: sessionToken
    };
    room.spectators.push(spectatorObj);
    return sessionToken;
  }

  // Remove a player from the room while preserving the current match state as much as possible
  removePlayer(room, playerId) {
    if (!room || !room.players) return null;

    const removeIdx = room.players.findIndex(p => p.id === playerId);
    if (removeIdx === -1) return null;

    const [removedPlayer] = room.players.splice(removeIdx, 1);
    const nextPlayer = room.players[removeIdx] || room.players[0] || null;

    if (room.players.length === 0) {
      room.turn = null;
      room.dealerIndex = 0;
      room.bidStarterIndex = 0;
      return removedPlayer;
    }

    if (typeof room.dealerIndex === 'number') {
      if (removeIdx < room.dealerIndex) {
        room.dealerIndex -= 1;
      } else if (room.dealerIndex >= room.players.length) {
        room.dealerIndex = 0;
      }
    }

    if (typeof room.bidStarterIndex === 'number') {
      if (removeIdx < room.bidStarterIndex) {
        room.bidStarterIndex -= 1;
      } else if (room.bidStarterIndex >= room.players.length) {
        room.bidStarterIndex = 0;
      }
    }

    if (room.turn === playerId) {
      room.turn = nextPlayer ? nextPlayer.id : room.players[0].id;
    }

    if (removedPlayer?.isHost && room.players.length > 0) {
      this.migrateHost(room);
    }

    return removedPlayer;
  }

  // Perform Host Migration: promote oldest connected non-spectator player as host
  migrateHost(room) {
    const activePlayers = room.players.filter(p => p.isConnected);
    if (activePlayers.length > 0) {
      // Find the one that was first in the players list (oldest registration)
      const oldestPlayer = room.players.find(p => p.isConnected);
      if (oldestPlayer) {
        room.players.forEach(p => p.isHost = false);
        oldestPlayer.isHost = true;
        return oldestPlayer;
      }
    }
    return null;
  }

  // Generate sanitized state personalized to a specific recipient (playerId)
  getSanitizedRoom(room, recipientPlayerId) {
    if (!room) return null;

    const sanitizedPlayers = room.players.map(p => {
      const isOwner = p.id === recipientPlayerId;

      // Calculate allowed bid options if it's the owner's turn during bidding phase
      let allowedBids = [];
      if (isOwner && room.phase === 'BIDDING' && room.turn === recipientPlayerId) {
        const totalBidsSoFar = room.players
          .filter(pl => pl.bid !== null)
          .reduce((sum, pl) => sum + pl.bid, 0);

        const bidStarterIndex = ((room.round - 1) % room.players.length + room.players.length) % room.players.length;
        const lastBidderIndex = (bidStarterIndex - 1 + room.players.length) % room.players.length;
        const forbiddenBid = room.lastBidRestriction && room.players[lastBidderIndex]?.id === room.turn
          ? room.round - totalBidsSoFar
          : null;

        for (let i = 0; i <= room.round; i++) {
          if (i !== forbiddenBid) {
            allowedBids.push(i);
          }
        }
      }

      return {
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        isHost: p.isHost,
        connected: p.isConnected,
        handCount: p.hand ? p.hand.length : 0,
        // Censor hand cards from other players
        hand: isOwner ? p.hand : [],
        guessSubmitted: p.bid !== null,
        // Censor bid amounts of other players during bidding phase
        bid: (isOwner || room.phase !== 'BIDDING') ? p.bid : (p.bid !== null ? -1 : null),
        tricksWon: p.tricksWon,
        score: p.score,
        roundScores: p.roundScores,
        roundGuesses: p.roundGuesses,
        roundWins: p.roundWins,
        allowedBids: isOwner ? allowedBids : [],
        isMyTurn: room.turn === p.id
      };
    });

    const isSpectator = room.spectators.some(s => s.id === recipientPlayerId);

    return {
      roomCode: room.roomCode,
      version: room.version,
      players: sanitizedPlayers || [],
      spectators: (room.spectators || []).map(s => ({
        id: s.id,
        name: s.name,
        avatar: s.avatar,
        connected: s.isConnected
      })),
      round: room.round,
      maxRounds: room.maxRounds,
      trump: room.trump,
      tableCards: room.tableCards || [],
      turn: room.turn,
      currentTurn: room.turn,
      phase: room.phase,
      scoreMode: room.scoreMode,
      lastBidRestriction: room.lastBidRestriction,
      settings: room.settings || {
        totalRounds: room.maxRounds,
        scoreMode: room.scoreMode,
        enableLastBidRestriction: room.lastBidRestriction
      },
      chat: room.chat || [],
      lastTrickWinner: room.lastTrickWinner,
      isSpectator
    };
  }
}

// Export singleton instance
const instance = new RoomManager();
export default instance;
