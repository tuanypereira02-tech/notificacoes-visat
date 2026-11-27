'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const replicaSender = read('portal/fichas/js/envio-ficha.js');
assert.match(replicaSender, /Envio desativado na réplica/);
assert.doesNotMatch(replicaSender, /ENVIO_CHAVE|script\.google\.com\/macros\/s|fetch\s*\(/i);

const server = read('seguranca/notificacoes/Code.gs');
assert.match(server, /PRODUCAO_LIBERADA/);
assert.match(server, /HOMOLOGACAO/);
assert.match(server, /validarTurnstile_/);
assert.match(server, /DriveApp\.Access\.PRIVATE/);
assert.match(server, /idempotencia_sha256/);
assert.doesNotMatch(server, /Logger\.log|console\.log/);

const client = read('seguranca/notificacoes/client/visat-envio-api.js');
assert.match(client, /credentials:\s*'omit'/);
assert.match(client, /referrerPolicy:\s*'no-referrer'/);
assert.doesNotMatch(client, /ENVIO_CHAVE|TURNSTILE_SECRET|password\s*=/i);

console.log('OK: réplica sem envio, servidor fail-closed e cliente sem segredo.');
