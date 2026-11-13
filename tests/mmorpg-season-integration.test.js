import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync(new URL('../backend/mmorpg-server.cjs', import.meta.url), 'utf8');

test('authoritative mob defeat writes seasonal kill progress in the combat transaction', () => {
  assert.match(server, /function currentSeasonId\(date = new Date\(\)\)/);
  assert.match(server, /if \(hp === 0\) \{[\s\S]{0,1000}INSERT INTO character_season_objectives/);
  assert.match(server, /\['chapter_1', 60\], \['chapter_10', 250\]/);
  assert.match(server, /character_season_objectives\.progress\+1/);
});

test('authoritative quest completions advance the seasonal quest objective',()=>{
  assert.match(server,/completedQuests\.length\) await recordSeasonProgress\(tx, state\.character\.id, currentSeasonId\(\), 'chapter_4', completedQuests\.length\)/);
});
test('dungeon and raid completions award seasonal progress inside their completion transactions',()=>{
  const instances=fs.readFileSync(new URL('../backend/mmorpg-instance-routes.cjs',import.meta.url),'utf8');
  const raids=fs.readFileSync(new URL('../backend/mmorpg-raid-encounter-routes.cjs',import.meta.url),'utf8');
  assert.match(instances,/recordSeasonProgress\(tx, member\.character_id, seasonId, 'chapter_3', 1\)/);
  assert.match(instances,/recordSeasonProgress\(tx, member\.character_id, seasonId, 'chapter_11', 1\)/);
  assert.match(raids,/recordSeasonProgress\(tx,characterId,seasonId,'chapter_6',1\)/);
});
