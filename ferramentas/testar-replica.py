#!/usr/bin/env python3
"""Regressões locais: cópia íntegra, modo de teste, PDF e impossibilidade de envio."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("preparar_replica", ROOT / "ferramentas/preparar-replica.py")
replica = importlib.util.module_from_spec(spec)
spec.loader.exec_module(replica)


class ReplicaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.before = {name: (ROOT / "site-visat" / name).read_bytes() for name in replica.FILES}
        cls.bundle = replica.prepare_bundle(ROOT)

    @classmethod
    def tearDownClass(cls):
        after = {name: (ROOT / "site-visat" / name).read_bytes() for name in replica.FILES}
        if cls.before != after:
            raise AssertionError("As fontes oficiais foram alteradas durante o teste.")

    def test_local_dependencies_and_no_delivery_code(self):
        replica.validate_bundle(self.bundle)
        module = self.bundle["js/envio-ficha.js"].decode()
        self.assertNotIn("fetch(", module)
        self.assertNotIn("async function enviar", module)
        self.assertNotIn(".onsubmit", module)
        self.assertNotIn("mailto:", self.bundle["formularios-inline-teste.html"].decode())
        self.assertNotIn("sites.google.com/view/visat-sms-pmf", self.bundle["assets/portal-search.js"].decode())
        self.assertIn('../conteudo/index.html', self.bundle["consulta-sites.html"].decode())
        self.assertEqual(self.bundle["data/empresas-visat.json"], self.before["data/empresas-visat.json"])

    def test_missing_dependency_is_rejected(self):
        broken = dict(self.bundle)
        del broken["js/teste/app.js"]
        with self.assertRaisesRegex(replica.ReplicaError, "Recurso local ausente"):
            replica.validate_bundle(broken)

    def test_delivery_endpoint_is_rejected(self):
        broken = dict(self.bundle)
        broken["js/envio-ficha.js"] += b"\nconst ENVIO_CHAVE = 'nao-publicar';"
        with self.assertRaisesRegex(replica.ReplicaError, "proibido"):
            replica.validate_bundle(broken)

    def test_company_cpf_is_rejected_without_revealing_it(self):
        row = ["", "EMPRESA 00000000000", "", ""] + [""] * 10
        with self.assertRaises(replica.ReplicaError) as error:
            replica.validate_company_data(json.dumps([row]).encode())
        self.assertNotIn("00000000000", str(error.exception))

    def test_install_check_and_failed_install_rollback(self):
        with tempfile.TemporaryDirectory() as temporary:
            destination = Path(temporary) / "fichas"
            replica.install_bundle(destination, self.bundle)
            replica.check_directory(destination, self.bundle)
            (destination / "preservar.txt").write_text("cópia anterior")
            original_rename = Path.rename

            def fail_staging(path, target):
                if path.name.startswith(".fichas-stage-"):
                    raise OSError("falha de instalação simulada")
                return original_rename(path, target)

            with patch.object(Path, "rename", fail_staging):
                with self.assertRaisesRegex(OSError, "simulada"):
                    replica.install_bundle(destination, self.bundle)
            self.assertEqual((destination / "preservar.txt").read_text(), "cópia anterior")
            with self.assertRaisesRegex(replica.ReplicaError, "divergente"):
                replica.check_directory(destination, self.bundle)

    def test_invalid_source_does_not_touch_existing_output(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            subprocess.run(["git", "init", "-q", str(root)], check=True)
            destination = root / "portal" / "fichas"
            destination.mkdir(parents=True)
            marker = destination / "preservar.txt"
            marker.write_text("manter")
            with self.assertRaisesRegex(replica.ReplicaError, "Fonte obrigatória"):
                bundle = replica.prepare_bundle(root)
                replica.install_bundle(destination, bundle)
            self.assertEqual(marker.read_text(), "manter")

    @unittest.skipUnless(shutil.which("node"), "Node.js necessário para verificar execução do módulo local")
    def test_bootstrap_pdf_and_no_email_in_node(self):
        with tempfile.TemporaryDirectory() as temporary:
            destination = Path(temporary) / "fichas"
            replica.install_bundle(destination, self.bundle)
            script = r"""
const fs = require('fs'), vm = require('vm'), assert = require('assert'), path = require('path');
const root = process.argv[1];
const bootstrap = fs.readFileSync(path.join(root, 'assets/replica-fichas.js'), 'utf8');
for (const query of ['', '?homologacao=0&escopo=outro&agravo=1-a', '?homologacao=1&escopo=visat']) {
  const location = {href:'https://replica.example/portal/fichas/consulta-sites.html'+query,
    replace(url) { this.href = url; }};
  const window = {location, history:{replaceState(state,title,url){location.href=url;}}};
  vm.runInNewContext(bootstrap, {window,URL});
  const result = new URL(location.href);
  assert.equal(result.searchParams.get('homologacao'),'1');
  assert.equal(result.searchParams.get('escopo'),'visat');
  if(query.includes('agravo')) assert.equal(result.searchParams.get('agravo'),'1-a');
  assert.equal(window.VISAT_REPLICA_SEM_ENVIO,true);
}
{
  let redirects = 0;
  const location = {href:'https://replica.example/portal/fichas/consulta-sites.html?homologacao=0',
    replace(url){redirects++;this.href=url;}};
  const window = {location,history:{replaceState(){throw new Error('histórico bloqueado');}}};
  vm.runInNewContext(bootstrap,{window,URL});
  vm.runInNewContext(bootstrap,{window,URL});
  assert.equal(redirects,1,'O fallback não pode entrar em loop de redirecionamento');
}
(async()=>{
  let networkCalls = 0, sent = false;
  const window = {
    fetch(){networkCalls++;throw new Error('A réplica tentou enviar dados');},
    XMLHttpRequest(){networkCalls++;throw new Error('A réplica tentou enviar dados');}
  };
  window.window = window;
  vm.createContext(window);
  vm.runInContext(fs.readFileSync(path.join(root,'js/vendor/pdf-lib.min.js'),'utf8'), window);
  vm.runInContext(fs.readFileSync(path.join(root,'js/envio-ficha.js'),'utf8'), window);
  const status = {hidden:true};
  const response = window.VisatEnvio.abrirJanela({retorno:status,aoEnviar(){sent=true;}});
  assert.equal(response,false); assert.equal(networkCalls,0); assert.equal(sent,false);
  assert.equal(status.hidden,false); assert.match(status.textContent,/não envia/);
  const area = {dataset:{},querySelector(selector){
    return selector==='.pf-title'?{textContent:'Ficha fictícia de teste'}:null;
  },querySelectorAll(){return []}};
  const bytes = await window.VisatEnvio.gerarPdf(area,'rodapé que não afirma homologação');
  assert(bytes.length>100); assert.equal(networkCalls,0);
  const pdf = await window.PDFLib.PDFDocument.load(bytes);
  assert.match(pdf.getTitle(),/^HOMOLOGAÇÃO/); assert(pdf.getPageCount()>0);
  console.log('OK: homologação obrigatória, PDF válido e nenhuma chamada de envio.');
})().catch(error=>{console.error(error);process.exit(1);});
"""
            result = subprocess.run(["node", "-e", script, str(destination)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
