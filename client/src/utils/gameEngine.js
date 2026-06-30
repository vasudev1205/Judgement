export const SUITS = ['S', 'H', 'C', 'D']; // Spade, Heart, Club, Diamond
export const SUIT_NAMES = {
  S: 'Spades',
  H: 'Hearts',
  C: 'Clubs',
  D: 'Diamonds'
};
export const SUIT_SYMBOLS = {
  S: '♠',
  H: '♥',
  C: '♣',
  D: '♦'
};
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const RANK_VALUES = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

// Generate standard 52 deck
export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, value: RANK_VALUES[rank] });
    }
  }
  return deck;
}

// Shuffle deck
export function shuffleDeck(deck) {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}

// Get trump suit for the round
export function getTrumpSuit(roundNumber) {
  const suits = [
    "SPADE",
    "DIAMOND",
    "CLUB",
    "HEART"
  ];
  // Pick a random index between 0 and 3
  return suits[Math.floor(Math.random() * suits.length)];
}

// Get maximum rounds based on player count
export function getMaxRounds(playerCount) {
  if (playerCount < 2) return 1;
  return Math.floor(52 / playerCount);
}

// Validate if playing a card is legal
export function validatePlay(card, hand, leadCard, trumpSuit) {
  // 1. Player must own the card
  const ownsCard = hand.some(c => c.suit === card.suit && c.rank === card.rank);
  if (!ownsCard) {
    return { valid: false, error: 'Card not in hand' };
  }

  // 2. If there is a lead card, player must follow suit if possible
  if (leadCard) {
    const leadSuit = leadCard.suit;
    const hasLeadSuit = hand.some(c => c.suit === leadSuit);
    if (hasLeadSuit && card.suit !== leadSuit) {
      return { valid: false, error: `Must follow suit: ${SUIT_NAMES[leadSuit]} (${SUIT_SYMBOLS[leadSuit]})` };
    }
  }

  return { valid: true };
}

// Evaluate winner of the trick
// playedCards: array of { playerId, playerName, card }
export function evaluateTrickWinner(playedCards, trumpSuit) {
  if (!playedCards || playedCards.length === 0) return null;

  const leadCard = playedCards[0].card;
  const leadSuit = leadCard.suit;

  let winningPlay = playedCards[0];

  const normalizedTrump = trumpSuit && trumpSuit.length > 1 ? (
    trumpSuit === 'SPADE' ? 'S' : trumpSuit === 'DIAMOND' ? 'D' : trumpSuit === 'CLUB' ? 'C' : 'H'
  ) : trumpSuit;

  for (let i = 1; i < playedCards.length; i++) {
    const currentPlay = playedCards[i];
    const currentCard = currentPlay.card;
    const winningCard = winningPlay.card;

    // Condition 1: Current card is Trump, winning card is NOT Trump
    if (currentCard.suit === normalizedTrump && winningCard.suit !== normalizedTrump) {
      winningPlay = currentPlay;
    }
    // Condition 2: Both cards are Trump, compare rank values
    else if (currentCard.suit === normalizedTrump && winningCard.suit === normalizedTrump) {
      if (currentCard.value > winningCard.value) {
        winningPlay = currentPlay;
      }
    }
    // Condition 3: Neither card is Trump, current card follows lead suit, winning card does NOT follow lead suit
    else if (currentCard.suit === leadSuit && winningCard.suit !== leadSuit && winningCard.suit !== normalizedTrump) {
      winningPlay = currentPlay;
    }
    // Condition 4: Both follow lead suit (and neither is Trump), compare rank values
    else if (currentCard.suit === leadSuit && winningCard.suit === leadSuit) {
      if (currentCard.value > winningCard.value) {
        winningPlay = currentPlay;
      }
    }
  }

  return winningPlay;
}

// Calculate scores based on Guess vs Won
export function calculateScore(guess, won, scoreMode) {
  const isCorrect = guess === won;
  
  if (scoreMode === 'MODE2') {
    // Mode 2: Won * 10, Special case: guess = 0 and won = 0 is 10 points. Wrong guess is 0.
    if (isCorrect) {
      if (guess === 0) return 10;
      return won * 10;
    }
    return 0;
  } else {
    // Mode 1 (Default): 10 + Won if guess == won, else 0
    if (isCorrect) {
      return 10 + won;
    }
    return 0;
  }
}
