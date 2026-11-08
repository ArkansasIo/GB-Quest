'use strict';
// Adventurer progression rank is independent of item rarity and character level.
const RankSystem = (() => {
  const ladder = [
    ['F', 0], ['E', 100], ['D', 250], ['C', 500], ['B', 900],
    ['A', 1500], ['S', 2500], ['SS', 4000], ['SSS', 6000],
  ];
  function score(character) {
    const stats = character && character.stats || {};
    const count = value => Math.max(0, Math.floor(Number(value) || 0));
    const achievements = Object.keys(character && character.ach || {}).length;
    const bossKills = Object.values(character && character.bossKills || {}).reduce((sum, value) => sum + count(value), 0);
    const explored = Object.keys(character && character.visited || {}).length;
    return achievements * 10
      + count(stats.kills)
      + bossKills * 20
      + count(stats.dungeons) * 25
      + count(stats.raids) * 50
      + count(stats.trials) * 40
      + count(character && character.towerBest) * 2
      + count(stats.pvpWins) * 10
      + count(stats.quests) * 2
      + explored * 5;
  }
  function forScore(value) {
    const points = Math.max(0, Math.floor(Number(value) || 0));
    let index = 0;
    for (let i = 1; i < ladder.length; i++) if (points >= ladder[i][1]) index = i;
    const [id, min] = ladder[index];
    const next = ladder[index + 1];
    return { id, score: points, min, next: next ? next[1] : null, progress: next ? Math.min(1, (points - min) / (next[1] - min)) : 1 };
  }
  function forCharacter(character) {
    return forScore(score(character || {}));
  }
  return Object.freeze({ ladder: Object.freeze(ladder.map(([id, min]) => Object.freeze({ id, min }))), score, forScore, forCharacter });
})();
globalThis.GBQRankSystem = RankSystem;
