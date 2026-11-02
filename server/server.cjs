#!/usr/bin/env node
// Backwards-compatible path. The realm backend now lives in ../backend/server.cjs.
'use strict';
module.exports = require('../backend/server.cjs');
