// MatchHistory.js - Mongoose Model for finalized game histories
import mongoose from 'mongoose';

const matchHistorySchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    uppercase: true
  },
  players: [
    {
      id: String,
      name: String,
      score: Number,
      roundGuesses: [Number],
      roundWins: [Number],
      roundScores: [Number]
    }
  ],
  maxRounds: {
    type: Number,
    required: true
  },
  scoreMode: {
    type: String,
    required: true
  },
  winner: {
    id: String,
    name: String,
    score: Number
  },
  playedAt: {
    type: Date,
    default: Date.now
  }
});

const MatchHistory = mongoose.model('MatchHistory', matchHistorySchema);
export default MatchHistory;
