'use strict';

// Authenticated, same-realm persistent direct-message history.
async function handleWhisperRequest({ req, res, url, pool, accountFor, json = (response, status, data) => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(data));
} }) {
  const match = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/whispers$/i);
  if (!match) return false;
  if (!['GET', 'POST'].includes(req.method)) return false;
  const account = await accountFor(req);
  if (!account) { json(res, 401, { error: 'unauthorized' }); return true; }
  const characterId = match[1];
  const owned = await pool.query(
    'SELECT id,realm_id FROM characters WHERE id=$1 AND account_id=$2',
    [characterId, account.id]
  );
  if (!owned.rowCount) { json(res, 404, { error: 'character_not_found' }); return true; }
  if (req.method === 'GET') {
    const withCharacter = String(url.searchParams.get('with') || '');
    if (!/^[0-9a-f-]{36}$/i.test(withCharacter)) {
      json(res, 400, { error: 'with_character_id_required' }); return true;
    }
    const peer = await pool.query('SELECT id FROM characters WHERE id=$1 AND realm_id=$2', [withCharacter, owned.rows[0].realm_id]);
    if (!peer.rowCount) { json(res, 404, { error: 'same_realm_character_not_found' }); return true; }
    const limit = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get('limit') || '50', 10) || 50));
    await pool.query(`UPDATE player_whispers SET read_at=now()
      WHERE realm_id=$1 AND sender_character_id=$2 AND recipient_character_id=$3 AND read_at IS NULL`,
      [owned.rows[0].realm_id, withCharacter, characterId]);
    const result = await pool.query(`
      SELECT id, sender_character_id AS "senderCharacterId",
             recipient_character_id AS "recipientCharacterId", message,
             created_at AS "createdAt", read_at AS "readAt"
      FROM player_whispers
      WHERE realm_id=$1 AND
        ((sender_character_id=$2 AND recipient_character_id=$3) OR
         (sender_character_id=$3 AND recipient_character_id=$2))
      ORDER BY created_at DESC LIMIT $4`,
      [owned.rows[0].realm_id, characterId, withCharacter, limit]);
    json(res, 200, { withCharacter, messages: result.rows.reverse() });
    return true;
  }
  json(res, 405, { error: 'method_not_allowed' });
  return true;
}

module.exports = { handleWhisperRequest };
