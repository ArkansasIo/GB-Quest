/** Deterministic dice expression parser and roller. */
export function parseDice(expression) {
  const m = String(expression).trim().match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!m) throw new TypeError("Invalid dice expression");
  const count = Number(m[1] || 1), sides = Number(m[2]), modifier = Number(m[3] || 0);
  if (count < 1 || count > 100 || sides < 2 || sides > 1000) throw new RangeError("Dice expression out of range");
  return { count, sides, modifier };
}
export function rollDice(expression, random = Math.random) {
  const { count, sides, modifier } = parseDice(expression);
  const rolls = Array.from({ length: count }, () => {
    const n = random();
    if (!(n >= 0 && n < 1)) throw new RangeError("Random source must return [0, 1)");
    return 1 + Math.floor(n * sides);
  });
  return { expression, rolls, modifier, total: rolls.reduce((a,b)=>a+b, modifier) };
}
