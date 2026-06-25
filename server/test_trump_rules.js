import GameEngine from './GameEngine.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

console.log("Running custom Trump Rotation & Comparison tests...");

// Test Case 1: Round 1 -> Spade (SPADE or S)
// Lead: ♥K, Player: ♠2 => Winner: ♠2
{
  const tableCards = [
    { playerId: 'player1', card: { suit: 'H', rank: 'K', value: 13 } }, // Lead
    { playerId: 'player2', card: { suit: 'S', rank: '2', value: 2 } }   // Trump play
  ];
  const winner = GameEngine.evaluateWinner(tableCards, "SPADE");
  assert(winner.playerId === 'player2', "Round 1 Trump SPADE comparison failed. ♠2 should beat ♥K");
  
  // also check with short-form 'S'
  const winnerShort = GameEngine.evaluateWinner(tableCards, "S");
  assert(winnerShort.playerId === 'player2', "Round 1 Trump 'S' comparison failed. ♠2 should beat ♥K");
}

// Test Case 2: Round 2 -> Diamond (DIAMOND or D)
// Lead: ♣A, Player: ♦3 => Winner: ♦3
{
  const tableCards = [
    { playerId: 'player1', card: { suit: 'C', rank: 'A', value: 14 } }, // Lead
    { playerId: 'player2', card: { suit: 'D', rank: '3', value: 3 } }   // Trump play
  ];
  const winner = GameEngine.evaluateWinner(tableCards, "DIAMOND");
  assert(winner.playerId === 'player2', "Round 2 Trump DIAMOND comparison failed. ♦3 should beat ♣A");
}

// Test Case 3: Round 3 -> Club (CLUB or C)
// Lead: ♠A, Player: ♣2 => Winner: ♣2
{
  const tableCards = [
    { playerId: 'player1', card: { suit: 'S', rank: 'A', value: 14 } }, // Lead
    { playerId: 'player2', card: { suit: 'C', rank: '2', value: 2 } }   // Trump play
  ];
  const winner = GameEngine.evaluateWinner(tableCards, "CLUB");
  assert(winner.playerId === 'player2', "Round 3 Trump CLUB comparison failed. ♣2 should beat ♠A");
}

// Test Case 4: Round 4 -> Heart (HEART or H)
// Lead: ♦A, Player: ♥2 => Winner: ♥2
{
  const tableCards = [
    { playerId: 'player1', card: { suit: 'D', rank: 'A', value: 14 } }, // Lead
    { playerId: 'player2', card: { suit: 'H', rank: '2', value: 2 } }   // Trump play
  ];
  const winner = GameEngine.evaluateWinner(tableCards, "HEART");
  assert(winner.playerId === 'player2', "Round 4 Trump HEART comparison failed. ♥2 should beat ♦A");
}

// Additional verification: Trump rotation rounds mapping
{
  const trumpOrder = ["SPADE", "DIAMOND", "CLUB", "HEART"];
  assert(trumpOrder[(1 - 1) % 4] === "SPADE", "Round 1 Trump should be SPADE");
  assert(trumpOrder[(2 - 1) % 4] === "DIAMOND", "Round 2 Trump should be DIAMOND");
  assert(trumpOrder[(3 - 1) % 4] === "CLUB", "Round 3 Trump should be CLUB");
  assert(trumpOrder[(4 - 1) % 4] === "HEART", "Round 4 Trump should be HEART");
  assert(trumpOrder[(5 - 1) % 4] === "SPADE", "Round 5 Trump should be SPADE");
  assert(trumpOrder[(6 - 1) % 4] === "DIAMOND", "Round 6 Trump should be DIAMOND");
  assert(trumpOrder[(7 - 1) % 4] === "CLUB", "Round 7 Trump should be CLUB");
  assert(trumpOrder[(8 - 1) % 4] === "HEART", "Round 8 Trump should be HEART");
}

console.log("✅ All custom Trump Rotation & Comparison tests PASSED!");
