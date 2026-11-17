// Executar da raiz do repositório: node scripts/testar-correspondencia-cnae.cjs
const fs = require('node:fs');
const assert = require('node:assert/strict');
const tabela = JSON.parse(fs.readFileSync('data/cnae-sinan.json','utf8'));
const mapa = JSON.parse(fs.readFileSync('data/cnae-correspondencias.json','utf8'));
const permitidos = new Set(tabela.classes.map(r=>r[0]));
assert.equal(permitidos.size,580);
assert.equal(Object.keys(mapa.subclasses).length,1332);
let automaticas=0;
for(const [origem,r] of Object.entries(mapa.subclasses)) {
  assert.match(origem,/^\d{7}$/);
  assert.equal(new Set(r.codigos).size,r.codigos.length);
  assert.ok(r.codigos.every(c=>permitidos.has(c)));
  assert.ok(r.ausentes.every(c=>!permitidos.has(c)));
  if(r.automatico) {
    automaticas++;
    assert.equal(r.codigos.length,1);
    assert.equal(r.ausentes.length,0);
    assert.equal(r.metodo,'subclasses_2.3_2.2_2.1_2.0_fiscal1.1');
  }
}
assert.equal(automaticas,mapa.resumo.automaticas);
assert.deepEqual(mapa.subclasses['8531700'].codigos,['80314']);
assert.deepEqual(mapa.subclasses['8532500'].codigos,['80322']);
assert.deepEqual(mapa.subclasses['6201501'].codigos,['72290','72400']);
assert.equal(mapa.subclasses['6201501'].automatico,false);
assert.deepEqual(mapa.subclasses['1621800'].ausentes,['20214']);
assert.deepEqual(mapa.subclasses['9900800'].ausentes,['99007']);
assert.equal(mapa.subclasses['7410299'].automatico,false); // lacuna na planilha histórica
assert.equal(mapa.subclasses['8430200'].automatico,false); // ausente na correspondência 2.3
console.log(`${Object.keys(mapa.subclasses).length} subclasses verificadas, ${automaticas} unívocas e ${mapa.resumo.revisao} para revisão.`);
