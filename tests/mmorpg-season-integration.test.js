import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync(new URL('../backend/mmorpg-server.cjs', import.meta.url), 'utf8');

test('authoritative mob defeat writes seasonal kill progress in the combat transaction', () => {
  assert.match(server, /function currentSeasonId\(date = new Date\(\)\)/);
  assert.match(server, /if \(hp === 0\) \{[\s\S]{0,1000}INSERT INTO character_season_objectives/);
  assert.match(server, /recordSeasonProgress\(tx, state\.character\.id, seasonId, 'chapter_1', 1\)/);
  assert.match(server, /recordSeasonProgress\(tx, state\.character\.id, seasonId, 'chapter_10', 1\)/);
  assert.match(server, /seasonalObjectivesForMobRank\(mob\.mob_rank\)/);
  assert.match(server, /SELECT id,spawn_id,name,hp,max_hp,level,mob_rank,zone_id,x,y FROM world_mobs/);
});

test('authoritative quest completions advance the seasonal quest objective',()=>{
  assert.match(server,/completedQuests\.length\) await recordSeasonProgress\(tx, state\.character\.id, currentSeasonId\(\), 'chapter_4', completedQuests\.length\)/);
});


test('mob rank mapping awards elite and world-boss objectives only for explicit database classifications',()=>{
  const seasonRoutes = fs.readFileSync(new URL('../backend/mmorpg-season-routes.cjs',import.meta.url),'utf8');
  assert.match(seasonRoutes,/if \(rank === 'elite'\) return \['chapter_2'\]/);
  assert.match(seasonRoutes,/if \(rank === 'world_boss'\) return \['chapter_5', 'chapter_12'\]/);
});
