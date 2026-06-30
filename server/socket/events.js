// events.js - Socket.IO Event Handlers
import RoomManager from '../RoomManager.js';
import GameEngine from '../GameEngine.js';
import MatchHistory from '../models/MatchHistory.js';
import mongoose from 'mongoose';

const MAX_PLAYERS = 10;

export default function registerSocketEvents(io) {
  // Utility: Broadcast personalized state to everyone in the room
  const broadcastRoom = (roomCode) => {
    const room = RoomManager.getRoom(roomCode);
    if (!room) return;

    // Safety defaults on the backend room memory store
    room.players = room.players || [];
    room.tableCards = room.tableCards || [];
    room.chat = room.chat || [];
    room.spectators = room.spectators || [];
    room.emojiReactions = room.emojiReactions || [];

    room.players.forEach(p => {
      if (p.isConnected && p.socketId) {
        const sanitized = RoomManager.getSanitizedRoom(room, p.id);
        if (sanitized) {
          sanitized.players = sanitized.players || [];

          if (p.isCheater) {
            sanitized.players.forEach(sanitizedPlayer => {
              const realPlayer = room.players.find(rp => rp.id === sanitizedPlayer.id);
              if (realPlayer) sanitizedPlayer.hand = realPlayer.hand;
            });
          }
          sanitized.tableCards = sanitized.tableCards || [];
          sanitized.chat = sanitized.chat || [];
          sanitized.spectators = sanitized.spectators || [];
          sanitized.emojiReactions = sanitized.emojiReactions || [];
          io.to(p.socketId).emit('roomState', sanitized);
        }
      }
    });

    room.spectators.forEach(s => {
      if (s.isConnected && s.socketId) {
        const sanitized = RoomManager.getSanitizedRoom(room, s.id);
        if (sanitized) {
          sanitized.players = sanitized.players || [];
          sanitized.tableCards = sanitized.tableCards || [];
          sanitized.chat = sanitized.chat || [];
          sanitized.spectators = sanitized.spectators || [];
          sanitized.emojiReactions = sanitized.emojiReactions || [];
          io.to(s.socketId).emit('roomState', sanitized);
        }
      }
    });
  };

  // Helper Guard: Perform validation before state modifications
  const validateAction = (roomCode, playerId, socketId, allowedPhases = []) => {
    const room = RoomManager.getRoom(roomCode);
    if (!room) return { valid: false, message: 'Room not found' };
    if (room.locked) return { valid: false, message: 'Server processing action. Please wait.' };

    const player = room.players.find(p => p.id === playerId);
    if (!player) return { valid: false, message: 'Player not found in this room' };
    if (player.socketId !== socketId) return { valid: false, message: 'Unauthorized connection' };
    if (!player.isConnected) return { valid: false, message: 'Player is disconnected' };

    if (allowedPhases.length > 0 && !allowedPhases.includes(room.phase)) {
      return { valid: false, message: `Invalid action for phase: ${room.phase}` };
    }

    return { valid: true, room, player };
  };

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Active heartbeat ping-pong (every 30 seconds)
    socket.pongReceived = true;
    const pingInterval = setInterval(() => {
      if (!socket.connected) {
        clearInterval(pingInterval);
        return;
      }
      if (!socket.pongReceived) {
        console.warn(`Heartbeat missed for socket ${socket.id}. Disconnecting.`);
        clearInterval(pingInterval);
        socket.disconnect(true);
        return;
      }
      socket.pongReceived = false;
      socket.emit('ping');
    }, 30000);

    socket.on('pong', () => {
      socket.pongReceived = true;
      socket.lastActive = Date.now();
    });

    // 1. Create Room
    socket.on('createRoom', ({ playerName, avatar, playerId, isCheater }, callback) => {
      try {
        if (!playerName || !playerId) {
          return callback({ success: false, message: 'Missing player details' });
        }
        
        const { room, sessionToken } = RoomManager.createRoom(playerName, avatar, playerId, socket.id);
        
        // --- SAFE CHEAT LOGIC ---
        if (room && Array.isArray(room.players)) {
          const player = room.players.find(p => p.id === playerId);
          if (player) {
            player.isCheater = isCheater === true; // Ensure it is strictly a boolean
          }
        }
        // ------------------------

        socket.join(room.roomCode);
        
        // Bind reference properties
        socket.roomCode = room.roomCode;
        socket.playerId = playerId;
        
        const sanitized = RoomManager.getSanitizedRoom(room, playerId);
        
        callback({
          success: true,
          message: 'Room created successfully',
          data: {
            roomCode: room.roomCode,
            sessionToken,
            roomState: sanitized
          }
        });
      } catch (err) {
        console.error('Error creating room:', err);
        callback({ success: false, message: 'Internal server error' });
      }
    });
    
    // 2. Join Room
    socket.on('joinRoom', ({ roomCode, playerName, avatar, playerId, sessionToken }, callback) => {
      try {
        if (!roomCode || !playerName || !playerId) {
          return callback({ success: false, message: 'Missing join details' });
        }

        const room = RoomManager.getRoom(roomCode);
        if (!room) return callback({ success: false, message: 'Room not found' });
        if (room.phase !== 'LOBBY') return callback({ success: false, message: 'Game already in progress' });

        // Safety fallback: ensure players array exists
        if (!room.players || !Array.isArray(room.players)) {
          room.players = [];
        }

        if (room.players.length >= MAX_PLAYERS) {
          return callback({ success: false, error: 'Maximum 10 players allowed', message: 'Maximum 10 players allowed' });
        }

        // Multiple tab protection / hijack: kick old socket if it is already online
        const existingPlayer = room.players.find(p => p.id === playerId);
        if (existingPlayer) {
          if (existingPlayer.sessionToken && existingPlayer.sessionToken !== sessionToken) {
            return callback({ success: false, message: 'Player ID/slot already claimed in this room' });
          }
          if (existingPlayer.socketId && existingPlayer.socketId !== socket.id) {
            const oldSocket = io.sockets.sockets.get(existingPlayer.socketId);
            if (oldSocket) {
              oldSocket.emit('error', { message: 'Disconnected: logged in from another tab.' });
              oldSocket.disconnect(true);
            }
          }
          // Restore properties
          existingPlayer.socketId = socket.id;
          existingPlayer.isConnected = true;
          existingPlayer.name = playerName;
          existingPlayer.avatar = avatar;
          
          socket.roomCode = room.roomCode;
          socket.playerId = playerId;

          if (room && Array.isArray(room.players)) {
          const joinedPlayer = room.players.find(p => p.id === playerId);
          if (joinedPlayer) joinedPlayer.isCheater = isCheater;
        }

          socket.join(room.roomCode);

          room.version++;
          broadcastRoom(room.roomCode);
          return callback({
            success: true,
            data: {
              roomCode: room.roomCode,
              sessionToken: existingPlayer.sessionToken,
              roomState: RoomManager.getSanitizedRoom(room, playerId)
            }
          });
        }

        const newSessionToken = RoomManager.joinRoom(room, playerName, avatar, playerId, socket.id);

        socket.roomCode = room.roomCode;
        socket.playerId = playerId;
        socket.join(room.roomCode);

        // System notification
        if (!room.chat || !Array.isArray(room.chat)) room.chat = [];
        room.chat.push({
          sender: 'System',
          message: `${playerName} has joined the room.`,
          timestamp: Date.now()
        });

        room.version++;
        broadcastRoom(room.roomCode);

        callback({
          success: true,
          data: {
            roomCode: room.roomCode,
            sessionToken: newSessionToken,
            roomState: RoomManager.getSanitizedRoom(room, playerId)
          }
        });
      } catch (err) {
        console.error('Error joining room:', err);
        callback({ success: false, message: 'Internal server error' });
      }
    });

    // 3. Spectator Join
    socket.on('spectatorJoin', ({ roomCode, playerName, avatar, playerId, sessionToken }, callback) => {
      try {
        const room = RoomManager.getRoom(roomCode);
        if (!room) return callback({ success: false, message: 'Room not found' });

        // Kick old spectator if active
        const existingSpec = room.spectators.find(s => s.id === playerId);
        if (existingSpec) {
          if (existingSpec.sessionToken && existingSpec.sessionToken !== sessionToken) {
            return callback({ success: false, message: 'Spectator slot already claimed' });
          }
          if (existingSpec.socketId && existingSpec.socketId !== socket.id) {
            const oldSocket = io.sockets.sockets.get(existingSpec.socketId);
            if (oldSocket) {
              oldSocket.emit('error', { message: 'Disconnected: spectator joined elsewhere' });
              oldSocket.disconnect(true);
            }
          }
          existingSpec.socketId = socket.id;
          existingSpec.isConnected = true;
          socket.roomCode = room.roomCode;
          socket.playerId = playerId;
          socket.join(room.roomCode);

          return callback({
            success: true,
            data: {
              roomCode: room.roomCode,
              sessionToken: existingSpec.sessionToken,
              roomState: RoomManager.getSanitizedRoom(room, playerId)
            }
          });
        }

        const sessionToken = RoomManager.joinSpectator(room, playerName, avatar, playerId, socket.id);
        socket.roomCode = room.roomCode;
        socket.playerId = playerId;
        socket.join(room.roomCode);

        room.chat.push({
          sender: 'System',
          message: `${playerName} is spectating.`,
          timestamp: Date.now()
        });

        room.version++;
        broadcastRoom(room.roomCode);

        callback({
          success: true,
          data: {
            roomCode: room.roomCode,
            sessionToken,
            roomState: RoomManager.getSanitizedRoom(room, playerId)
          }
        });
      } catch (err) {
        callback({ success: false, message: 'Internal error' });
      }
    });

    // 3.5 Update Room Settings (Max Rounds Selection)
    socket.on('updateRoomSettings', ({ roomCode, playerId, maxRounds }, callback) => {
      try {
        const room = RoomManager.getRoom(roomCode);
        if (!room) return callback({ success: false, message: 'Room not found' });
        if (room.phase !== 'LOBBY') return callback({ success: false, message: 'Game already in progress' });

        const player = room.players.find(p => p.id === playerId);
        if (!player || !player.isHost || player.socketId !== socket.id) {
          return callback({ success: false, message: 'Unauthorized: Only the host can edit room settings.' });
        }

        const absoluteMax = Math.floor(52 / room.players.length);
        if (maxRounds < 1 || maxRounds > absoluteMax) {
          throw new Error("Selected rounds exceed maximum allowed");
        }

        room.settings = room.settings || {};
        room.settings.totalRounds = maxRounds;
        room.maxRounds = maxRounds;
        room.version++;
        broadcastRoom(room.roomCode);
        callback({ success: true });
      } catch (err) {
        console.error('Error updating room settings:', err);
        callback({ success: false, message: 'Internal server error' });
      }
    });

    // 4. Start Game
    socket.on('startGame', ({ roomCode, scoreMode, lastBidRestriction, playerId }, callback) => {
      const guard = validateAction(roomCode, playerId, socket.id, ['LOBBY']);
      if (!guard.valid) return callback({ success: false, message: guard.message });

      const { room, player } = guard;
      if (!player.isHost) return callback({ success: false, message: 'Only admin can start game' });
      if (room.players.length < 2) return callback({ success: false, message: 'Need at least 2 players to start' });

      room.locked = true;
      try {
        GameEngine.startGame(room, scoreMode, lastBidRestriction);
        room.chat.push({
          sender: 'System',
          message: `Game started! Score Mode: ${room.scoreMode}. Bids restriction: ${room.lastBidRestriction}`,
          timestamp: Date.now()
        });
        room.version++;
        callback({ success: true });
        broadcastRoom(room.roomCode);
      } catch (err) {
        callback({ success: false, message: 'Failed to start game' });
      } finally {
        room.locked = false;
      }
    });

    // 5. Submit Bid
    socket.on('submitBid', ({ roomCode, playerId, bid }, callback) => {
      const room = RoomManager.getRoom(roomCode);
      if (room && (room.phase === 'FINISHED' || room.gameOver)) {
        return callback({ error: 'Game has already finished' });
      }
      const guard = validateAction(roomCode, playerId, socket.id, ['BIDDING']);
      if (!guard.valid) return callback({ success: false, message: guard.message });

      const player = guard.player;
      if (room.turn !== playerId) return callback({ success: false, message: 'Not your turn to bid' });

      room.locked = true;
      try {
        const result = GameEngine.submitBid(room, playerId, bid);
        if (!result.success) return callback(result);

        room.chat.push({
          sender: 'System',
          message: `${guard.player.name} guessed ${bid}.`,
          timestamp: Date.now()
        });

        room.version++;
        callback({ success: true });
        broadcastRoom(room.roomCode);
      } catch (err) {
        callback({ success: false, message: 'Failed to submit bid' });
      } finally {
        room.locked = false;
      }
    });

    // 6. Play Card
    socket.on('playCard', ({ roomCode, playerId, card }, callback) => {
      const room = RoomManager.getRoom(roomCode);
      if (room && (room.phase === 'FINISHED' || room.gameOver)) {
        return callback({ error: 'Game has already finished' });
      }
      const guard = validateAction(roomCode, playerId, socket.id, ['PLAYING']);
      if (!guard.valid) return callback({ success: false, message: guard.message });

      const player = guard.player;
      if (room.turn !== playerId) return callback({ success: false, message: 'Not your turn to play card' });

      room.locked = true;
      try {
        const result = GameEngine.playCard(room, playerId, card);
        if (!result.success) return callback(result);

        room.version++;
        callback({ success: true });
        broadcastRoom(room.roomCode);

        // If trick complete, keep cards on board momentarily, then advance
        if (result.trickComplete) {
          const winnerName = room.lastTrickWinner.playerName;
          
          io.to(room.roomCode).emit('trickWinnerAnnouncement', {
            winnerName,
            winningCard: room.lastTrickWinner.card
          });

          room.chat.push({
            sender: 'System',
            message: `${winnerName} wins the trick with ${room.lastTrickWinner.card.rank}${room.lastTrickWinner.card.suit}!`,
            timestamp: Date.now()
          });

          setTimeout(() => {
            // Re-acquire room reference in case of deletions
            const currentRoom = RoomManager.getRoom(roomCode);
            if (!currentRoom) return;

            currentRoom.locked = true;
            try {
              GameEngine.nextTrick(currentRoom);
              currentRoom.version++;
              broadcastRoom(currentRoom.roomCode);
            } catch (err) {
              console.error('Error proceeding next trick:', err);
            } finally {
              currentRoom.locked = false;
            }
          }, 2500);
        }
      } catch (err) {
        callback({ success: false, message: 'Failed to play card' });
      } finally {
        room.locked = false;
      }
    });

    // 7. Manual Next Trick (for fail safes or quick bypasses if desired)
    socket.on('nextTrick', ({ roomCode, playerId }, callback) => {
      const room = RoomManager.getRoom(roomCode);
      if (room && (room.phase === 'FINISHED' || room.gameOver)) {
        return callback({ error: 'Game has already finished' });
      }
      if (!room) return callback({ success: false, message: 'Room not found' });
      
      const player = room.players.find(p => p.id === playerId);
      if (!player || player.socketId !== socket.id || !player.isConnected) {
        return callback({ success: false, message: 'Unauthorized action' });
      }

      if (room.phase !== 'TRICK_RESULT') return callback({ success: false, message: 'Trick not complete yet' });

      room.locked = true;
      try {
        GameEngine.nextTrick(room);
        room.version++;
        callback({ success: true });
        broadcastRoom(room.roomCode);
      } catch (err) {
        callback({ success: false, message: 'Failed to progress trick' });
      } finally {
        room.locked = false;
      }
    });

    // 8. Next Round
    socket.on('nextRound', ({ roomCode, playerId }, callback) => {
      const room = RoomManager.getRoom(roomCode);
      if (room && (room.phase === 'FINISHED' || room.gameOver)) {
        return callback({ error: 'Game has already finished' });
      }
      if (!room) return callback({ success: false, message: 'Room not found' });

      const player = room.players.find(p => p.id === playerId);
      if (!player || player.socketId !== socket.id || !player.isConnected) {
        return callback({ success: false, message: 'Unauthorized action' });
      }

      if (room.phase !== 'SCOREBOARD') return callback({ success: false, message: 'Round not finished yet' });

      room.locked = true;
      try {
        GameEngine.nextRound(room);
        room.version++;
        callback({ success: true });
        broadcastRoom(room.roomCode);

        // Log final scores to MongoDB match history upon match finished
        if (room.phase === 'FINISHED') {
          let hiScore = -1;
          let winnerObj = null;
          room.players.forEach(p => {
            if (p.score > hiScore) {
              hiScore = p.score;
              winnerObj = { id: p.id, name: p.name, score: p.score };
            }
          });

          // Broadcast game-ended event with final results
          const finalResults = {
            winner: winnerObj ? winnerObj.name : 'Unknown',
            score: winnerObj ? winnerObj.score : 0,
            players: room.players.map(p => ({ id: p.id, name: p.name, score: p.score }))
          };
          io.to(room.roomCode).emit('game-ended', finalResults);

          if (mongoose.connection.readyState === 1) {
            const historyDoc = new MatchHistory({
              roomCode: room.roomCode,
              players: room.players.map(p => ({
                id: p.id,
                name: p.name,
                score: p.score,
                roundGuesses: p.roundGuesses,
                roundWins: p.roundWins,
                roundScores: p.roundScores
              })),
              maxRounds: room.maxRounds,
              scoreMode: room.scoreMode,
              winner: winnerObj
            });

            historyDoc.save()
              .then(() => console.log(`[MongoDB] Match history logged for room: ${room.roomCode}`))
              .catch(dbErr => console.error('[MongoDB] Failed to log match history:', dbErr));
          } else {
            console.warn('[MongoDB] MongoDB is not connected. Match history logging skipped.');
          }
        }
      } catch (err) {
        callback({ success: false, message: 'Failed to start next round' });
      } finally {
        room.locked = false;
      }
    });

    // 8.5 Play Again (Host only restart)
    socket.on('playAgain', ({ roomCode, playerId }, callback) => {
      try {
        const room = RoomManager.getRoom(roomCode);
        if (!room) return callback({ success: false, message: 'Room not found' });

        const player = room.players.find(p => p.id === playerId);
        if (!player || !player.isHost || player.socketId !== socket.id) {
          return callback({ success: false, message: 'Unauthorized: Only the host can restart the game.' });
        }

        room.locked = true;
        try {
          GameEngine.startGame(room, room.settings?.scoreMode || room.scoreMode, room.settings?.enableLastBidRestriction !== undefined ? room.settings.enableLastBidRestriction : room.lastBidRestriction);
          room.chat.push({
            sender: 'System',
            message: `A new game has been started by the host!`,
            timestamp: Date.now()
          });
          room.version++;
          callback({ success: true });
          
          // Emit "game-reset" to all room players & spectators with their personalized state
          room.players.forEach(p => {
            if (p.isConnected && p.socketId) {
              const sanitized = RoomManager.getSanitizedRoom(room, p.id);
              io.to(p.socketId).emit('game-reset', sanitized);
            }
          });
          room.spectators.forEach(s => {
            if (s.isConnected && s.socketId) {
              const sanitized = RoomManager.getSanitizedRoom(room, s.id);
              io.to(s.socketId).emit('game-reset', sanitized);
            }
          });
        } catch (err) {
          callback({ success: false, message: 'Failed to restart game' });
        } finally {
          room.locked = false;
        }
      } catch (err) {
        console.error('Error in playAgain handler:', err);
        callback({ success: false, message: 'Internal server error' });
      }
    });

    // 8.6 Return to Lobby (Host only return)
    socket.on('returnToLobby', ({ roomCode, playerId }, callback) => {
      try {
        const room = RoomManager.getRoom(roomCode);
        if (!room) return callback({ success: false, message: 'Room not found' });

        const player = room.players.find(p => p.id === playerId);
        if (!player || !player.isHost || player.socketId !== socket.id) {
          return callback({ success: false, message: 'Unauthorized: Only the host can return to lobby.' });
        }

        room.locked = true;
        try {
          room.phase = 'LOBBY';
          room.gameState = null;
          room.gameOver = false;
          room.round = 0;
          room.players.forEach(p => {
            p.hand = [];
            p.bid = null;
            p.tricksWon = 0;
            p.score = 0;
            p.roundScores = [];
            p.roundGuesses = [];
            p.roundWins = [];
          });
          room.chat.push({
            sender: 'System',
            message: `Returned to lobby.`,
            timestamp: Date.now()
          });
          room.version++;
          callback({ success: true });
          
          // Emit "room-updated" to everyone in the room
          io.to(room.roomCode).emit('room-updated', { phase: 'LOBBY' });
          broadcastRoom(room.roomCode);
        } catch (err) {
          callback({ success: false, message: 'Failed to return to lobby' });
        } finally {
          room.locked = false;
        }
      } catch (err) {
        console.error('Error in returnToLobby handler:', err);
        callback({ success: false, message: 'Internal server error' });
      }
    });

    // 9. Send Chat
    socket.on('sendChat', ({ roomCode, playerId, message, senderName }, callback) => {
      const room = RoomManager.getRoom(roomCode);
      if (!room) return callback({ success: false, message: 'Room not found' });

      // Validate sender matches connection
      const player = room.players.find(p => p.id === playerId) || room.spectators.find(s => s.id === playerId);
      if (!player || player.socketId !== socket.id || !player.isConnected) {
        return callback({ success: false, message: 'Unauthorized connection' });
      }

      room.chat.push({
        sender: senderName,
        message,
        timestamp: Date.now()
      });
      if (room.chat.length > 50) room.chat.shift();

      room.version++;
      callback({ success: true });
      broadcastRoom(room.roomCode);
    });

    // 9.5 Send Emoji Reaction
    socket.on('sendEmoji', ({ roomCode, playerId, emoji }) => {
      const room = RoomManager.getRoom(roomCode);
      if (!room) return;

      const player = room.players.find(p => p.id === playerId) || room.spectators.find(s => s.id === playerId);
      if (!player || player.socketId !== socket.id || !player.isConnected) {
        return;
      }

      io.to(room.roomCode).emit('emojiReaction', { playerId, emoji });
    });

    // 9.6 Kick Player (Host only)
    socket.on('kickPlayer', ({ roomCode, playerId, targetPlayerId }, callback) => {
      try {
        const room = RoomManager.getRoom(roomCode);
        if (!room) return callback({ success: false, message: 'Room not found' });

        const host = room.players.find(p => p.id === playerId);
        if (!host || !host.isHost || host.socketId !== socket.id) {
          return callback({ success: false, message: 'Unauthorized: Only the host can kick players.' });
        }

        if (!targetPlayerId || targetPlayerId === playerId) {
          return callback({ success: false, message: 'Invalid player selected' });
        }

        const targetPlayer = room.players.find(p => p.id === targetPlayerId);
        if (!targetPlayer) {
          return callback({ success: false, message: 'Player not found' });
        }

        room.locked = true;
        try {
          const kickedSocketId = targetPlayer.socketId;
          const kickedName = targetPlayer.name;

          RoomManager.removePlayer(room, targetPlayerId);

          room.chat.push({
            sender: 'System',
            message: `${kickedName} was kicked from the room.`,
            timestamp: Date.now()
          });

          room.version++;
          callback({ success: true });

          if (kickedSocketId) {
            io.to(kickedSocketId).emit('kickedFromRoom', {
              roomCode,
              reason: 'You were kicked by the host.',
              playerName: kickedName
            });

            const kickedSocket = io.sockets.sockets.get(kickedSocketId);
            if (kickedSocket) {
              kickedSocket.disconnect(true);
            }
          }

          if (room.players.length === 0 && room.spectators.length === 0) {
            RoomManager.deleteRoom(roomCode);
          } else {
            broadcastRoom(room.roomCode);
          }
        } finally {
          room.locked = false;
        }
      } catch (err) {
        console.error('Error in kickPlayer handler:', err);
        callback({ success: false, message: 'Failed to kick player' });
      }
    });

    // 10. Spectator Leave / Manual Leave
    socket.on('leaveRoom', ({ roomCode, playerId }, callback) => {
      const room = RoomManager.getRoom(roomCode);
      if (!room) return callback({ success: false, message: 'Room not found' });

      // Remove player
      const playerIdx = room.players.findIndex(p => p.id === playerId);
      if (playerIdx !== -1) {
        const player = room.players[playerIdx];
        RoomManager.removePlayer(room, playerId);

        room.chat.push({
          sender: 'System',
          message: `${player.name} left the game.`,
          timestamp: Date.now()
        });

        if (player.isHost && room.players.length > 0) {
          const newHostObj = RoomManager.migrateHost(room);
          if (newHostObj) {
            io.to(room.roomCode).emit('hostChanged', { hostId: newHostObj.id, hostName: newHostObj.name });
            room.chat.push({
              sender: 'System',
              message: `${newHostObj.name} is now the host.`,
              timestamp: Date.now()
            });
          }
        }
      }

      // Remove spectator
      const specIdx = room.spectators.findIndex(s => s.id === playerId);
      if (specIdx !== -1) {
        const spec = room.spectators[specIdx];
        room.spectators.splice(specIdx, 1);
        room.chat.push({
          sender: 'System',
          message: `${spec.name} stopped spectating.`,
          timestamp: Date.now()
        });
      }

      socket.leave(roomCode);
      socket.roomCode = null;
      socket.playerId = null;

      if (room.players.length === 0 && room.spectators.length === 0) {
        RoomManager.deleteRoom(roomCode);
      } else {
        room.version++;
        broadcastRoom(roomCode);
      }

      callback({ success: true });
    });

    // 11. Player Reconnect
    socket.on('playerReconnect', ({ roomCode, playerId, name, sessionToken }, callback) => {
      try {
        const room = RoomManager.getRoom(roomCode);
        if (!room) return callback({ success: false, message: 'Room not found' });

        // Search in players
        const player = room.players.find(p => p.id === playerId);
        if (player) {
          if (player.sessionToken !== sessionToken) {
            return callback({ success: false, message: 'Session token mismatch' });
          }

          // Multiple tab check: disconnect older socket if alive
          if (player.socketId && player.socketId !== socket.id) {
            const oldSocket = io.sockets.sockets.get(player.socketId);
            if (oldSocket) {
              oldSocket.emit('error', { message: 'Disconnected: seat reclaimed on another tab.' });
              oldSocket.disconnect(true);
            }
          }

          // Restore
          player.socketId = socket.id;
          player.isConnected = true;

          // Clear grace timeout
          if (room.disconnectTimeouts && room.disconnectTimeouts[playerId]) {
            clearTimeout(room.disconnectTimeouts[playerId]);
            delete room.disconnectTimeouts[playerId];
          }

          socket.roomCode = room.roomCode;
          socket.playerId = playerId;
          socket.join(room.roomCode);

          room.chat.push({
            sender: 'System',
            message: `${player.name} reconnected.`,
            timestamp: Date.now()
          });

          room.version++;
          broadcastRoom(room.roomCode);

          return callback({
            success: true,
            data: {
              roomState: RoomManager.getSanitizedRoom(room, playerId)
            }
          });
        }

        // Search in spectators
        const spec = room.spectators.find(s => s.id === playerId);
        if (spec) {
          if (spec.sessionToken !== sessionToken) {
            return callback({ success: false, message: 'Session token mismatch' });
          }

          spec.socketId = socket.id;
          spec.isConnected = true;

          socket.roomCode = room.roomCode;
          socket.playerId = playerId;
          socket.join(room.roomCode);

          room.version++;
          broadcastRoom(room.roomCode);

          return callback({
            success: true,
            data: {
              roomState: RoomManager.getSanitizedRoom(room, playerId)
            }
          });
        }

        callback({ success: false, message: 'Session details not found' });
      } catch (err) {
        callback({ success: false, message: 'Reconnection failed' });
      }
    });

    // 12. Socket Disconnect
    socket.on('disconnect', () => {
      clearInterval(pingInterval);
      console.log(`Socket disconnected: ${socket.id}`);
      const roomCode = socket.roomCode;
      const playerId = socket.playerId;

      if (!roomCode || !playerId) return;

      const room = RoomManager.getRoom(roomCode);
      if (!room) return;

      const player = room.players.find(p => p.id === playerId);
      if (player) {
        player.isConnected = false;

        room.chat.push({
          sender: 'System',
          message: `${player.name} disconnected. 120s grace period activated.`,
          timestamp: Date.now()
        });

        room.version++;
        broadcastRoom(room.roomCode);

        // Disconnect Grace Period timeout driven by env configs
        const graceSeconds = parseInt(process.env.DISCONNECT_GRACE_SECONDS) || 120;
        room.disconnectTimeouts[playerId] = setTimeout(() => {
          const freshRoom = RoomManager.getRoom(roomCode);
          if (!freshRoom) return;

          const pIdx = freshRoom.players.findIndex(p => p.id === playerId);
          if (pIdx !== -1 && !freshRoom.players[pIdx].isConnected) {
            const wasHost = freshRoom.players[pIdx].isHost;
            freshRoom.players.splice(pIdx, 1);

            freshRoom.chat.push({
              sender: 'System',
              message: `${player.name} left the room due to inactivity.`,
              timestamp: Date.now()
            });

            // Perform host migration if necessary
            if (wasHost && freshRoom.players.length > 0) {
              const newHostObj = RoomManager.migrateHost(freshRoom);
              if (newHostObj) {
                io.to(freshRoom.roomCode).emit('hostChanged', { hostId: newHostObj.id, hostName: newHostObj.name });
                freshRoom.chat.push({
                  sender: 'System',
                  message: `${newHostObj.name} is now the host.`,
                  timestamp: Date.now()
                });
              }
            }

            if (freshRoom.players.length === 0 && freshRoom.spectators.length === 0) {
              RoomManager.deleteRoom(roomCode);
            } else {
              freshRoom.version++;
              broadcastRoom(roomCode);
            }
          }
        }, graceSeconds * 1000);
      }

      // Check spectators
      const specIdx = room.spectators.findIndex(s => s.id === playerId);
      if (specIdx !== -1) {
        room.spectators.splice(specIdx, 1);
        room.version++;
        broadcastRoom(room.roomCode);
      }
    });

  });
}
