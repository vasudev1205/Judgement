import { validatePlay, evaluateTrickWinner } from './gameEngine.js';

function getShortSuit(suit) {
  if (!suit) return suit;
  const upper = suit.toUpperCase();
  if (upper === 'SPADE' || upper === 'SPADES') return 'S';
  if (upper === 'DIAMOND' || upper === 'DIAMONDS') return 'D';
  if (upper === 'CLUB' || upper === 'CLUBS') return 'C';
  if (upper === 'HEART' || upper === 'HEARTS') return 'H';
  return suit;
}

// Calculate bot bid based on hand cards, trump suit, and constraints
export function makeBotBid({ hand, trumpSuit, roundNumber, bidsSoFar, isLastPlayer, lastBidRestriction }) {
  const shortTrump = getShortSuit(trumpSuit);
  let expectedTricks = 0;
  
  // Assess probability of winning for each card
  for (const card of hand) {
    if (card.suit === shortTrump) {
      // Trump cards have high values
      if (card.rank === 'A') expectedTricks += 0.95;
      else if (card.rank === 'K') expectedTricks += 0.85;
      else if (card.rank === 'Q') expectedTricks += 0.75;
      else if (card.rank === 'J') expectedTricks += 0.65;
      else if (card.rank === '10') expectedTricks += 0.55;
      else expectedTricks += 0.35; // Lower trumps
    } else {
      // Non-trump cards depend on rank and total cards in hand (higher rounds reduce chance of A/K winning)
      const handSizeFactor = 1 - (hand.length / 52);
      if (card.rank === 'A') expectedTricks += 0.70 * handSizeFactor;
      else if (card.rank === 'K') expectedTricks += 0.45 * handSizeFactor;
      else if (card.rank === 'Q') expectedTricks += 0.25 * handSizeFactor;
      else if (card.rank === 'J') expectedTricks += 0.10 * handSizeFactor;
      else expectedTricks += 0.02; // Low cards rarely win unless you trump
    }
  }

  let bid = Math.round(expectedTricks);

  // Constraints: bid cannot exceed hand size
  bid = Math.max(0, Math.min(hand.length, bid));

  // Apply Last Bid Restriction
  if (lastBidRestriction && isLastPlayer) {
    const totalTricks = roundNumber;
    const sumBids = bidsSoFar.reduce((sum, b) => sum + b, 0);
    const forbiddenBid = totalTricks - sumBids;
      // Check bounds
    if (bid === forbiddenBid) {
      const minBid = 0;
      const maxBid = hand.length;
      const preferred = bid;

      for (let offset = 1; offset <= Math.max(preferred - minBid, maxBid - preferred); offset++) {
        const upward = preferred + offset;
        if (upward <= maxBid && upward !== forbiddenBid) {
          bid = upward;
          break;
        }

        const downward = preferred - offset;
        if (downward >= minBid && downward !== forbiddenBid) {
          bid = downward;
          break;
        }
      }

      if (bid === forbiddenBid) {
        for (let candidate = minBid; candidate <= maxBid; candidate++) {
          if (candidate !== forbiddenBid) {
            bid = candidate;
            break;
          }
        }
      }
    }
  }

  return bid;
}

// Decide which card the bot should play
export function makeBotPlay({ hand, leadCard, playedCards, trumpSuit, bid, tricksWon }) {
  const shortTrump = getShortSuit(trumpSuit);
  // Get legal plays
  const legalCards = hand.filter(card => validatePlay(card, hand, leadCard, shortTrump).valid);
  
  if (legalCards.length === 0) {
    // Fallback: should never happen if validation is correct
    return hand[0];
  }

  const needsTricks = tricksWon < bid;

  // Case 1: Bot leads the trick (first to play)
  if (!leadCard || playedCards.length === 0) {
    if (needsTricks) {
      // Lead the highest card to win the trick
      return getHighestValuedCard(legalCards, shortTrump);
    } else {
      // Lead the lowest card to lose the trick
      return getLowestValuedCard(legalCards, shortTrump);
    }
  }

  // Case 2: Playing in response to other cards
  const winningPlay = evaluateTrickWinner(playedCards, shortTrump);
  const winningCard = winningPlay.card;

  // Check which cards can beat the current winning card
  const winningOptions = [];
  const losingOptions = [];

  for (const card of legalCards) {
    // Simulate playing this card
    const simulatedPlayedCards = [...playedCards, { playerId: 'bot', card }];
    const simulatedWinner = evaluateTrickWinner(simulatedPlayedCards, shortTrump);
    
    if (simulatedWinner.card === card) {
      winningOptions.push(card);
    } else {
      losingOptions.push(card);
    }
  }

  if (needsTricks) {
    // Try to win!
    if (winningOptions.length > 0) {
      // Play the lowest winning card to conserve high cards
      return getLowestValuedCard(winningOptions, shortTrump);
    } else {
      // Cannot win, discard the lowest valued card
      return getLowestValuedCard(losingOptions, shortTrump);
    }
  } else {
    // Try to lose!
    if (losingOptions.length > 0) {
      // Play the highest losing card to bleed high cards safely
      return getHighestValuedCard(losingOptions, shortTrump);
    } else {
      // Forced to win, play the lowest winning card
      return getLowestValuedCard(winningOptions, shortTrump);
    }
  }
}

// Helper: Get highest card based on trump/value
function getHighestValuedCard(cards, trumpSuit) {
  return [...cards].sort((a, b) => {
    // Trump card is always higher than non-trump
    if (a.suit === trumpSuit && b.suit !== trumpSuit) return -1;
    if (b.suit === trumpSuit && a.suit !== trumpSuit) return 1;
    // Otherwise sort by value
    return b.value - a.value;
  })[0];
}

// Helper: Get lowest card based on trump/value
function getLowestValuedCard(cards, trumpSuit) {
  return [...cards].sort((a, b) => {
    // Trump card is always higher than non-trump
    if (a.suit === trumpSuit && b.suit !== trumpSuit) return 1;
    if (b.suit === trumpSuit && a.suit !== trumpSuit) return -1;
    // Otherwise sort by value
    return a.value - b.value;
  })[0];
}
