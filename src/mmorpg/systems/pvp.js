const BATTLEGROUND_MODES = Object.freeze({
  banners: Object.freeze({
    id: "banners",
    name: "Banner Run",
    objective: "Capture the banner",
    teamSize: 3,
    targetScore: 3,
    objectives: Object.freeze(["North Banner", "South Banner", "Lower Banner", "Upper Banner", "Central Banner"]),
  }),
  waystones: Object.freeze({
    id: "waystones",
    name: "Waystone Control",
    objective: "Capture waystones",
    teamSize: 3,
    targetScore: 3,
    objectives: Object.freeze(["West Waystone", "North Waystone", "East Waystone", "South Waystone", "Central Waystone"]),
  }),
});

function createBattleground(modeId) {
  const mode = BATTLEGROUND_MODES[modeId];
  if (!mode) throw new RangeError("Unknown battleground mode");
  return {
    modeId,
    status: "active",
    score: { blue: 0, red: 0 },
    objectives: mode.objectives.slice(),
    captured: [],
    targetScore: mode.targetScore,
    teamSize: mode.teamSize,
    winner: null,
  };
}

function captureBattlegroundObjective(match, { team, objectiveId }) {
  if (!match || match.status !== "active") throw new Error("Battleground is not active");
  if (team !== "blue" && team !== "red") throw new RangeError("Invalid battleground team");
  if (!match.objectives.includes(objectiveId) || match.captured.includes(objectiveId)) {
    throw new RangeError("Objective is invalid or already captured");
  }
  match.captured.push(objectiveId);
  match.score[team]++;
  if (match.score[team] >= match.targetScore) {
    match.status = "complete";
    match.winner = team;
  } else if (match.captured.length === match.objectives.length) {
    match.status = "complete";
    match.winner = match.score.blue === match.score.red ? "draw" : match.score.blue > match.score.red ? "blue" : "red";
  }
  return { score: { ...match.score }, status: match.status, winner: match.winner };
}

function canAttack(attacker, target, { sameFaction = false, safeZone = false, duelAccepted = false, battleground = false } = {}) {
  if (!attacker || !target || attacker.id == null || target.id == null || attacker.id === target.id || sameFaction) return false;
  if (battleground) return true;
  if (safeZone && !duelAccepted) return false;
  if (duelAccepted) return true;
  return attacker.pvpEnabled === true && target.pvpEnabled === true;
}

function calculateHonor({ levelDifference = 0, base = 100, repeatPenalty = 0 } = {}) {
  if (!Number.isFinite(levelDifference) || !Number.isFinite(base) || !Number.isFinite(repeatPenalty) || base < 0) {
    throw new RangeError("Honor inputs must be finite and base must not be negative");
  }
  const levelMultiplier = 1 + Math.max(-0.5, Math.min(0.5, levelDifference * 0.05));
  const penaltyMultiplier = 1 - Math.max(0, Math.min(0.9, repeatPenalty));
  const total = base * levelMultiplier * penaltyMultiplier;
  return Math.max(0, Math.floor(total + Number.EPSILON * Math.max(1, Math.abs(total))));
}

globalThis.GBQ_PVP = Object.freeze({
  battlegroundModes: BATTLEGROUND_MODES,
  createBattleground,
  captureBattlegroundObjective,
  canAttack,
  calculateHonor,
});
