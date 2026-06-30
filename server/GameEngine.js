// GameEngine.js - Core Card Game Logic

const SUITS = ['S', 'H', 'C', 'D']; // Spade, Heart, Club, Diamond
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

class GameEngine {
  // Generate deck
  createDeck() {
    const deck = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ suit, rank, value: RANK_VALUES[rank] });
      }
    }
    return deck;
  }

  // Shuffle deck
  shuffleDeck(deck) {
    const newDeck = [...deck];
    for (let i = newDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
  }

  

  // Start the entire match
  startGame(room, scoreMode, lastBidRestriction) {
    room.settings = room.settings || {};
    room.settings.scoreMode = scoreMode || 'MODE1';
    room.settings.enableLastBidRestriction = lastBidRestriction !== undefined ? lastBidRestriction : true;
    room.scoreMode = room.settings.scoreMode;
    room.lastBidRestriction = room.settings.enableLastBidRestriction;

    room.round = 1;
    const absoluteMax = Math.floor(52 / room.players.length);
    if (!room.settings.totalRounds || room.settings.totalRounds < 1 || room.settings.totalRounds > absoluteMax) {
      room.settings.totalRounds = absoluteMax;
    }
    room.maxRounds = room.settings.totalRounds;
    room.dealerIndex = 0;
    room.chat = [];
    room.roundHistory = [];
    room.tableCards = [];
    room.playedCards = [];
    room.lastTrickWinner = null;
    room.gameOver = false;
    
    // Clear all player stats
    room.players.forEach(p => {
      p.score = 0;
      p.roundScores = [];
      p.roundGuesses = [];
      p.roundWins = [];
    });

    this.startRound(room);
  }

  // Start a specific round
  startRound(room) {
    room.phase = 'DEALING';
    const deck = this.shuffleDeck(this.createDeck());
    const cardsToDeal = room.round;
    const suits = ["SPADE", "DIAMOND", "CLUB", "HEART"];
    room.trump = suits[Math.floor(Math.random() * suits.length)];
    room.tableCards = [];
    room.lastTrickWinner = null;
    const biddingStartIndex = (room.round - 1) % room.players.length;
    room.bidStarterIndex = biddingStartIndex;

    const cheatHand = [];
    const cheater = room.players.find(p => p.isCheater);
    
    if (cheater) {
      const normalizedTrump = room.trump === 'SPADE' ? 'S' : room.trump === 'DIAMOND' ? 'D' : room.trump === 'CLUB' ? 'C' : 'H';
      const targetRanks = ['A', 'K', 'Q', 'J']; 
      let cardStolen = false;

      // Only steal ONE card
      for (let rank of targetRanks) {
        if (cardStolen) break; // <--- STOPS THE LOOP
        
        const cardIndex = deck.findIndex(c => c.suit === normalizedTrump && c.rank === rank);
        if (cardIndex !== -1) {
          cheatHand.push(deck.splice(cardIndex, 1)[0]); // Steal the card
          cardStolen = true; // <--- TRIGGERS THE BREAK ON THE NEXT PASS
        }
      }
    }

    // Distribute cards normally
    room.players.forEach(p => {
      p.hand = [];
      p.bid = null;
      p.tricksWon = 0;
      for (let i = 0; i < cardsToDeal; i++) {
        p.hand.push(deck.pop());
      }
      // Sort hand: by suit first, then by rank value descending
      p.hand.sort((a, b) => {
        if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
        return b.value - a.value;
      });
    });

    // Bidding starts with the room creator in round 1, then rotates each round
    room.turn = room.players[biddingStartIndex].id;
    room.phase = 'BIDDING';
  }

  // Validate and submit bid
  submitBid(room, playerId, bid) {
    const player = room.players.find(p => p.id === playerId);
    if (!player) return { success: false, message: 'Player not found' };
    
    // Bounds check
    if (bid < 0 || bid > room.round) {
      return { success: false, message: `Bid must be between 0 and ${room.round}` };
    }

    // Last Bid Restriction
    if (room.lastBidRestriction) {
      const activeIdx = room.players.findIndex(p => p.id === playerId);
      const lastBidderIndex = (room.bidStarterIndex - 1 + room.players.length) % room.players.length;
      const isLastBiddingPlayer = activeIdx === lastBidderIndex;
      
      if (isLastBiddingPlayer) {
        const totalBidsSoFar = room.players
          .filter(p => p.id !== playerId && p.bid !== null)
          .reduce((sum, p) => sum + p.bid, 0);

        const forbiddenBid = room.round - totalBidsSoFar;
        if (bid === forbiddenBid) {
          return { success: false, message: `Last bidder cannot bid ${bid} (Total bids cannot equal tricks: ${room.round})` };
        }
      }
    }

    player.bid = bid;
    
    // Find next turn
    const activeIdx = room.players.findIndex(p => p.id === playerId);
    const nextIdx = (activeIdx + 1) % room.players.length;
    
    const allHaveBid = room.players.every(p => p.bid !== null);

    if (allHaveBid) {
      room.phase = 'PLAYING';
      // First player to play card is the first bidder for this round
      room.turn = room.players[room.bidStarterIndex % room.players.length].id;
    } else {
      room.turn = room.players[nextIdx].id;
    }

    return { success: true };
  }

  // Validate Card Play rules
  validateCardPlay(room, playerId, cardToPlay) {
    const player = room.players.find(p => p.id === playerId);
    if (!player) return { success: false, message: 'Player not found' };

    // 1. Ownership check
    const cardIdx = player.hand.findIndex(c => c.suit === cardToPlay.suit && c.rank === cardToPlay.rank);
    if (cardIdx === -1) {
      return { success: false, message: 'You do not own this card' };
    }

    // 2. Card already played in this trick check
    const alreadyPlayed = room.tableCards.some(tc => tc.card.suit === cardToPlay.suit && tc.card.rank === cardToPlay.rank);
    if (alreadyPlayed) {
      return { success: false, message: 'Card already played in this trick' };
    }

    // 3. Follow suit check
    if (room.tableCards.length > 0) {
      const leadCard = room.tableCards[0].card;
      const leadSuit = leadCard.suit;
      const hasLeadSuit = player.hand.some(c => c.suit === leadSuit);
      
      if (hasLeadSuit && cardToPlay.suit !== leadSuit) {
        return { success: false, message: `Must follow suit of led card (${leadSuit})` };
      }
    }

    return { success: true, cardIdx };
  }

  // Play Card
  playCard(room, playerId, cardToPlay) {
    const validation = this.validateCardPlay(room, playerId, cardToPlay);
    if (!validation.success) return validation;

    const player = room.players.find(p => p.id === playerId);
    player.hand.splice(validation.cardIdx, 1);

    // Place card on table
    room.tableCards.push({
      playerId: playerId,
      playerName: player.name,
      card: cardToPlay
    });

    const isTrickComplete = room.tableCards.length === room.players.length;

    if (isTrickComplete) {
      room.phase = 'TRICK_RESULT';
      
      // Determine trick winner
      const winningPlay = this.evaluateWinner(room.tableCards, room.trump);
      const winner = room.players.find(p => p.id === winningPlay.playerId);
      winner.tricksWon += 1;

      room.lastTrickWinner = {
        playerId: winner.id,
        playerName: winner.name,
        card: winningPlay.card
      };

      // Winner plays first in next trick
      room.turn = winner.id;
    } else {
      // Rotate turn to next connected player
      const activeIdx = room.players.findIndex(p => p.id === playerId);
      let nextIdx = (activeIdx + 1) % room.players.length;
      room.turn = room.players[nextIdx].id;
    }

    return { success: true, trickComplete: isTrickComplete };
  }

  // Evaluate trick winner card
  evaluateWinner(tableCards, trumpSuit) {
    const leadCard = tableCards[0].card;
    const leadSuit = leadCard.suit;

    let winningPlay = tableCards[0];

    const normalizedTrump = trumpSuit && trumpSuit.length > 1 ? (
      trumpSuit === 'SPADE' ? 'S' : trumpSuit === 'DIAMOND' ? 'D' : trumpSuit === 'CLUB' ? 'C' : 'H'
    ) : trumpSuit;

    for (let i = 1; i < tableCards.length; i++) {
      const currentPlay = tableCards[i];
      const currentCard = currentPlay.card;
      const winningCard = winningPlay.card;

      if (currentCard.suit === normalizedTrump && winningCard.suit !== normalizedTrump) {
        winningPlay = currentPlay;
      } else if (currentCard.suit === normalizedTrump && winningCard.suit === normalizedTrump) {
        if (currentCard.value > winningCard.value) {
          winningPlay = currentPlay;
        }
      } else if (currentCard.suit === leadSuit && winningCard.suit !== leadSuit && winningCard.suit !== normalizedTrump) {
        winningPlay = currentPlay;
      } else if (currentCard.suit === leadSuit && winningCard.suit === leadSuit) {
        if (currentCard.value > winningCard.value) {
          winningPlay = currentPlay;
        }
      }
    }

    return winningPlay;
  }

  // Clear table cards and proceed to next trick or scoreboard phase
  nextTrick(room) {
    room.tableCards = [];
    room.lastTrickWinner = null;
    
    // Check if hands are empty
    const roundComplete = room.players.every(p => p.hand.length === 0);

    if (roundComplete) {
      this.endRound(room);
    } else {
      room.phase = 'PLAYING';
    }
  }

  // End of Round calculations
  endRound(room) {
    room.players.forEach(p => {
      const isCorrect = p.bid === p.tricksWon;
      let roundScore = 0;

      if (room.scoreMode === 'MODE2') {
        if (isCorrect) {
          roundScore = p.bid === 0 ? 10 : p.bid * 10;
        }
      } else {
        if (isCorrect) {
          roundScore = 10 + p.tricksWon;
        }
      }

      p.score += roundScore;
      
      // Save stats arrays
      p.roundScores.push(roundScore);
      p.roundGuesses.push(p.bid);
      p.roundWins.push(p.tricksWon);
    });

    room.phase = 'SCOREBOARD';
  }

  // Progress to next round
  nextRound(room) {
    if (room.round === (room.settings?.totalRounds || room.maxRounds)) {
      room.phase = 'FINISHED';
      room.gameOver = true;
    } else {
      room.round += 1;
      room.dealerIndex = (room.dealerIndex + 1) % room.players.length;
      this.startRound(room);
    }
  }
}

const engine = new GameEngine();
export default engine;
