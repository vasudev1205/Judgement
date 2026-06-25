// useSocket.js - React Hook for Socket Connection & Listeners
import { useEffect } from 'react';
import socket from '../services/socket.js';
import { useGameStore } from '../store/useGameStore.js';

export function useSocket() {
  const { playerId, playerName, roomCode } = useGameStore();

  useEffect(() => {
    // 1. Open the socket connection if disconnected
    if (!socket.connected) {
      socket.connect();
    }

    // 2. Setup listeners with strict deduplication (.off before .on)
    
    // Connect & Reconnect Handler
    socket.off('connect');
    socket.on('connect', () => {
      console.log('Socket connected successfully:', socket.id);
      useGameStore.setState({ isConnected: true, error: null });

      // Session recovery trigger
      const savedCode = localStorage.getItem('kachuful_room_code');
      const savedPlayerId = localStorage.getItem('kachuful_player_id');
      const savedName = localStorage.getItem('kachuful_player_name');
      const savedToken = localStorage.getItem('kachuful_session_token');

      if (savedCode && savedPlayerId && savedToken) {
        socket.emit('playerReconnect', {
          roomCode: savedCode,
          playerId: savedPlayerId,
          name: savedName,
          sessionToken: savedToken
        }, (res) => {
          if (res.success) {
            console.log('Session recovered successfully!');
            useGameStore.setState({
              roomCode: savedCode,
              playMode: 'ONLINE',
              activeTab: 'game',
              error: null
            });
            useGameStore.getState().syncRoomState(res.data.roomState);
          } else {
            console.warn('Session recovery failed:', res.message);
            // Clear stale cache to let player join normally
            localStorage.removeItem('kachuful_room_code');
            localStorage.removeItem('kachuful_session_token');
            useGameStore.setState({ roomCode: null, playMode: null, activeTab: 'dashboard' });
          }
        });
      }
    });

    // Disconnect Handler
    socket.off('disconnect');
    socket.on('disconnect', (reason) => {
      console.warn('Socket disconnected:', reason);
      useGameStore.setState({ isConnected: false });
    });

    // Heartbeat Ping Responder
    socket.off('ping');
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // Error Handler
    socket.off('error');
    socket.on('error', (err) => {
      console.error('Socket error event:', err.message);
      useGameStore.setState({ error: err.message });
    });

    socket.off('kickedFromRoom');
    socket.on('kickedFromRoom', ({ reason, playerName }) => {
      console.warn('Kicked from room:', reason || playerName);
      useGameStore.getState().handleKickedFromRoom(reason || 'You were kicked from the room.');
    });

    // Synchronize Room State
    socket.off('roomState');
    socket.on('roomState', (incomingState) => {
      useGameStore.getState().syncRoomState(incomingState);
    });

    // Host Changed Handler
    socket.off('hostChanged');
    socket.on('hostChanged', ({ hostName }) => {
      useGameStore.getState().addSystemChat(`${hostName} is now the host.`);
    });

    // Trick Winner Toast Announcement
    socket.off('trickWinnerAnnouncement');
    socket.on('trickWinnerAnnouncement', ({ winnerName, winningCard }) => {
      useGameStore.setState({
        trickWinnerToast: {
          winnerName,
          card: winningCard,
          key: Date.now()
        }
      });
      setTimeout(() => {
        useGameStore.setState({ trickWinnerToast: null });
      }, 2400);
    });

    // Emoji Reaction Handler
    socket.off('emojiReaction');
    socket.on('emojiReaction', ({ playerId, emoji }) => {
      useGameStore.getState().addEmojiReaction(playerId, emoji);
    });

    // Game Ended event
    socket.off('game-ended');
    socket.on('game-ended', (finalResults) => {
      console.log('Game ended event received:', finalResults);
      useGameStore.setState({
        phase: 'FINISHED',
        gameState: 'FINISHED',
        showFinalResult: true,
        finalResults: finalResults
      });
    });

    // Game Reset event
    socket.off('game-reset');
    socket.on('game-reset', (incomingState) => {
      console.log('Game reset event received:', incomingState);
      useGameStore.setState({
        trickWinnerToast: null,
        emojiReactions: [],
        tableCards: [],
        playedCards: [],
        lastTrickWinner: null,
        error: null,
        phase: incomingState.phase,
        gameState: incomingState.phase
      });
      useGameStore.getState().syncRoomState(incomingState);
    });

    // Room Updated event
    socket.off('room-updated');
    socket.on('room-updated', ({ phase }) => {
      console.log('Room updated:', phase);
      if (phase === 'LOBBY') {
        useGameStore.setState({
          phase: 'LOBBY',
          gameState: 'LOBBY',
          roundNumber: 0,
          round: 0,
          tableCards: [],
          playedCards: [],
          lastTrickWinner: null,
          error: null
        });
      }
    });

    // Cleanup listeners on unmount to prevent duplicate registrations & memory leaks
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('ping');
      socket.off('error');
      socket.off('kickedFromRoom');
      socket.off('roomState');
      socket.off('hostChanged');
      socket.off('trickWinnerAnnouncement');
      socket.off('emojiReaction');
      socket.off('game-ended');
      socket.off('game-reset');
      socket.off('room-updated');
    };
  }, [playerId, playerName, roomCode]);

  return socket;
}
