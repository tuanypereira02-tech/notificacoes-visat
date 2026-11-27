const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const repo = require('node:path').resolve(__dirname, '..') + '/';
const modeCode = fs.readFileSync(repo + 'portal/assets/modo-visat.js', 'utf8');
const searchCode = fs.readFileSync(repo + 'portal/assets/pesquisa-visat.js', 'utf8');
let assertions = 0;
function equal(a,b){ assertions++; assert.equal(a,b); }
function ok(a){ assertions++; assert.ok(a); }
class Node {
  constructor(tag, doc, type=1) { this.tagName=tag.toUpperCase();this.nodeType=type;this.ownerDocument=doc;this.children=[];this.attributes={};this.events={};this.hidden=false;this.value='';this.textContent=''; }
  get className(){return this.getAttribute('class')||'';} set className(x){this.setAttribute('class',x);}
  get id(){return this.getAttribute('id')||'';} set id(x){this.setAttribute('id',x);}
  get href(){return new URL(this.getAttribute('href'),this.ownerDocument.url).href;} set href(x){this.setAttribute('href',x);}
  get src(){return new URL(this.getAttribute('src'),this.ownerDocument.url).href;} set src(x){this.setAttribute('src',x);}
  setAttribute(k,v){this.attributes[k]=String(v);} getAttribute(k){return Object.hasOwn(this.attributes,k)?this.attributes[k]:null;} hasAttribute(k){return Object.hasOwn(this.attributes,k);} removeAttribute(k){delete this.attributes[k];}
  appendChild(c){if(c.nodeType===11){for(const n of [...c.children])this.appendChild(n);return c;}c.remove();this.children.push(c);c.parentElement=this;return c;}
  append(...cs){cs.forEach(c=>this.appendChild(c));}
  before(c){const p=this.parentElement;const i=p.children.indexOf(this);c.parentElement=p;p.children.splice(i,0,c);}
  remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(c=>c!==this);this.parentElement=null;}}
  replaceChildren(...cs){this.children.forEach(c=>c.parentElement=null);this.children=[];this.append(...cs);}
  matches(s){if(s==='*')return true;if(s.startsWith('.'))return this.className.split(/\s+/).includes(s.slice(1));let m=s.match(/^([a-z]+)(?:\[([^=\]]+)(?:="([^"]*)")?\])?$/);return !!m&&this.tagName===m[1].toUpperCase()&&(!m[2]||(this.hasAttribute(m[2])&&(m[3]===undefined||this.getAttribute(m[2])===m[3])));}
  querySelectorAll(s){let out=[];for(const c of this.children){if(c.matches(s))out.push(c);out.push(...c.querySelectorAll(s));}return out;}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  attachShadow(){if(this.shadowRoot)throw Error('duplicate shadow');return this.shadowRoot=new Node('shadow',this.ownerDocument,11);}
  focus(){this.ownerDocument.activeElement=this;}
  addEventListener(t,cb,opts){(this.events[t]||=[]).push({cb,once:!!opts?.once});}
  dispatchEvent(e){e.target ||= this;for(const l of [...(this.events[e.type]||[])]){if(l.once)this.events[e.type]=this.events[e.type].filter(x=>x!==l);l.cb(e);}return true;}
}
class Doc extends Node {
  constructor(url,loading){super('document',null,9);this.ownerDocument=this;this.url=url;this.readyState=loading?'loading':'complete';this.documentElement=new Node('html',this);this.head=new Node('head',this);this.body=new Node('body',this);this.appendChild(this.documentElement);this.documentElement.append(this.head,this.body);this.currentScript={src:new URL('../assets/modo-visat.js',url).href};}
  createElement(tag){const el=new Node(tag,this);if(tag==='template')el.content=new Node('fragment',this,11);return el;}
}
function fixture(mode='',loading=false,base='https://tuanypereira02-tech.github.io/notificacoes-visat/portal/conteudo/acidentes.html'){
 const url=new URL(base);url.search=mode;
 const d=new Doc(url.href,loading);const observers=[];const window={location:url};
 window.self=window;
 Object.defineProperty(window,'top',{configurable:true,get(){throw Error('must not inspect iframe parent during initialization');}});
 const env={window,document:d,URL,URLSearchParams,Map,Set,WeakSet,Promise,Object,Array,CustomEvent:class{constructor(type,opts){this.type=type;Object.assign(this,opts);}},MutationObserver:class{constructor(fn){this.fn=fn;}observe(root){this.root=root;observers.push(this);}}};
 vm.createContext(env);
 const make=(tag,attrs={},parent=d.body)=>{const el=d.createElement(tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);if(parent)parent.appendChild(el);return el;};
 const main=make('div',{class:'replica-conteudo'});make('main',{},main);
 return {d,env,make,window,observers,runMode(){vm.runInContext(modeCode,env);return window.VisatPortal;},runSearch(){vm.runInContext(searchCode,env);},loaded(){d.readyState='complete';d.dispatchEvent({type:'DOMContentLoaded'});}};
}
function navigationFixture({blockTop=false,blockPopup=false,standalone=false,mode='?modo=oficial'}={}) {
 const f=fixture(mode);const calls={top:[],popup:[],opened:[]};
 const topLocation={};Object.defineProperty(topLocation,'href',{set(href){calls.top.push(href);if(blockTop)throw Object.assign(new Error('Sandbox blocked top navigation'),{name:'SecurityError'});}});
 const popup={opener:f.window,location:{},close(){calls.closed=true;}};
 Object.defineProperty(popup.location,'href',{set(href){calls.popup.push(href);}});
 Object.defineProperty(f.window,'top',{value:standalone?f.window:{location:topLocation}});
 f.window.open=(href,target)=>{calls.opened.push([href,target]);return blockPopup?null:popup;};
 f.runMode();return {f,calls,popup};
}
function click(f,anchor,overrides={}) {
 const e={type:'click',isTrusted:true,button:0,defaultPrevented:false,composedPath:()=>[anchor],preventDefault(){this.defaultPrevented=true;},...overrides};
 f.d.dispatchEvent(e);return e;
}
(async()=>{
 let f=fixture();let api=f.runMode();equal(api.mode,'replica');equal(f.d.documentElement.getAttribute('data-modo'),'replica');
 equal(api.resolve('acidentes.html#pack-mb').href,'https://tuanypereira02-tech.github.io/notificacoes-visat/portal/conteudo/acidentes.html#pack-mb');
 equal(api.resolve('https://other.example/acidentes.html'),null);equal(api.resolve('/unrelated/acidentes.html'),null);
 equal(api.resolve('https://sites.google.com/view/gerve/notifica%C3%A7%C3%A3o-compuls%C3%B3ria'),null);
 equal(api.resolve('https://sites.google.com/view/visat-sms-pmf/den%C3%BAncias#assuntos').href,api.url('denuncias.html','#assuntos'));
 equal(api.resolve('../../site-visat/consulta-sites.html?homologacao=1&escopo=visat#ficha').href,api.url('como-notificar.html','#ficha'));
 equal(api.resolve('https://tuanypereira02-tech.github.io/notificacoes-visat/site-visat/consulta-sites.html').href,api.url('como-notificar.html'));
 equal(api.resolve('https://tuanypereira02-tech.github.io/other/site-visat/consulta-sites.html'),null);
 equal(api.resolve('#pack-mb'),null);equal(api.resolve('javascript:alert(1)'),null);equal(api.resolve('mailto:a@example.org'),null);
 equal(api.resolve('acidentes.html?tema=pep&modo=oficial#pack').href,api.url('acidentes.html')+'?tema=pep#pack');
 equal(api.url('unknown'),null);
 let download=f.make('a',{href:'acidentes.html',download:''});equal(api.prepareLink(download),false);equal(download.getAttribute('href'),'acidentes.html');
 for(const attr of ['data-visat-destino-direto','data-fichas-replica','data-fichas-oficial','data-fichas-operacionais']) {const direct=f.make('a',{href:'../../site-visat/consulta-sites.html',[attr]:''});equal(api.prepareLink(direct),false);equal(direct.getAttribute('href'),'../../site-visat/consulta-sites.html');}
 let external=f.make('a',{href:'https://other.example/acidentes.html',target:'_blank'});api.prepareLink(external);equal(external.getAttribute('target'),'_blank');
 f=fixture('?modo=oficial');const ordinary=f.make('a',{href:'denuncias.html#assunto'});const host=f.make('div');const shadow=host.attachShadow();const shadowLink=f.make('a',{href:'como-notificar.html'},shadow);const fallbackHost=f.make('div');const template=f.make('template',{shadowrootmode:'open'},fallbackHost);const fallbackLink=f.make('a',{href:'dados.html'},template.content);f.make('script',{'data-so-replica-src':'../assets/moldura-visat.js'},f.d.head);
 api=f.runMode();equal(api.mode,'oficial');equal(ordinary.href,'https://sites.google.com/view/visat-sms-pmf/den%C3%BAncias#assunto');equal(ordinary.getAttribute('target'),'_top');equal(shadowLink.href,api.url('como-notificar.html'));ok(fallbackHost.shadowRoot);equal(fallbackLink.href,api.url('dados.html'));equal(f.d.querySelectorAll('script[src]').length,0);
 const dynamic=f.make('a',{href:'acidentes.html#pack'},shadow);f.d.dispatchEvent({type:'click',composedPath:()=>[dynamic,shadow,host]});equal(dynamic.href,api.url('acidentes.html','#pack'));
 const mutationLink=f.make('a',{href:'contatos.html'},shadow);f.observers.find(o=>o.root===shadow).fn([{type:'childList',addedNodes:[mutationLink]}]);await Promise.resolve();equal(mutationLink.href,api.url('contatos.html'));
 f.runSearch();await api.ready;await Promise.resolve();equal(f.d.querySelectorAll('.visat-pesquisa').length,1);const input=f.d.querySelector('input');input.value='material biologico';input.dispatchEvent({type:'input'});let results=f.d.querySelector('ul');equal(results.querySelectorAll('a').length,1);equal(results.querySelector('a').href,api.url('acidentes.html'));equal(results.querySelector('a').getAttribute('target'),'_top');
 input.value='SINAN';input.dispatchEvent({type:'input'});equal(results.querySelector('a').href,api.url('como-notificar.html'));input.value='denúncia';input.dispatchEvent({type:'input'});equal(results.querySelector('a').href,api.url('denuncias.html'));input.value='<img src=x>';input.dispatchEvent({type:'input'});equal(results.querySelectorAll('a').length,0);equal(results.hidden,true);input.dispatchEvent({type:'keydown',key:'Escape'});equal(input.value,'');equal(f.d.querySelector('p').hidden,true);
 f.runSearch();equal(f.d.querySelectorAll('.visat-pesquisa').length,1);
 f=fixture('',true,'https://replica.example/conteudo/acidentes.html');f.runSearch();f.make('script',{'data-so-replica-src':'../assets/moldura-visat.js'},f.d.head);f.make('script',{'data-so-replica-src':'../assets/moldura-visat.js'},f.d.head);api=f.runMode();equal(f.d.querySelectorAll('script[src]').length,0);f.loaded();await api.ready;equal(f.d.querySelectorAll('script[src]').length,1);api.refresh();api.refresh();equal(f.d.querySelectorAll('script[src]').length,1);equal(f.d.querySelectorAll('.visat-pesquisa').length,1);equal(api.url('como-notificar.html'),'https://replica.example/conteudo/como-notificar.html');let ri=f.d.querySelector('input');ri.value='ficha';ri.dispatchEvent({type:'input'});equal(f.d.querySelector('ul').querySelector('a').href,api.url('como-notificar.html'));equal(f.d.querySelector('ul').querySelector('a').getAttribute('target'),'_self');
 const originalAPI=api;f.runMode();equal(f.window.VisatPortal,originalAPI);equal(f.d.querySelectorAll('script[src]').length,1);
 f=fixture('?modo=unknown');equal(f.runMode().mode,'replica');

 // Nenhuma navegação no carregamento; só gesto genuíno, sem modificadores.
 let n=navigationFixture();equal(n.calls.top.length+n.calls.opened.length,0);
 let a=n.f.make('a',{href:'contatos.html'});let e=click(n.f,a);equal(n.calls.top[0],n.f.window.VisatPortal.url('contatos.html'));equal(n.calls.opened.length,0);equal(e.defaultPrevented,true);
 n=navigationFixture({blockTop:true});a=n.f.make('a',{href:'acidentes.html#pack'});e=click(n.f,a);equal(n.calls.top.length,1);equal(n.calls.opened.length,1);equal(n.calls.popup[0],n.f.window.VisatPortal.url('acidentes.html','#pack'));equal(n.popup.opener,null);equal(e.defaultPrevented,true);
 n=navigationFixture({blockTop:true,blockPopup:true});a=n.f.make('a',{href:'dados.html'});click(n.f,a);const notice=n.f.d.querySelector('.visat-navegacao-aviso');ok(notice);equal(notice.getAttribute('role'),'alert');const alternative=notice.querySelector('a');equal(alternative.href,n.f.window.VisatPortal.url('dados.html'));equal(alternative.getAttribute('target'),'_blank');equal(alternative.getAttribute('rel'),'noopener noreferrer');equal(n.f.d.activeElement,alternative);e=click(n.f,alternative);equal(e.defaultPrevented,false);equal(n.calls.opened.length,1);notice.querySelector('button').dispatchEvent({type:'click'});equal(n.f.d.querySelector('.visat-navegacao-aviso'),null);
 for(const override of [{ctrlKey:true},{shiftKey:true},{metaKey:true},{altKey:true},{button:1},{isTrusted:false}]) {n=navigationFixture({blockTop:true});a=n.f.make('a',{href:'contatos.html'});e=click(n.f,a,override);equal(n.calls.top.length+n.calls.opened.length,0);equal(e.defaultPrevented,false);}
 n=navigationFixture({blockTop:true});a=n.f.make('a',{href:'contatos.html'});click(n.f,a,{defaultPrevented:true});equal(n.calls.top.length+n.calls.opened.length,0);
 for(const attrs of [{href:'#pack'},{href:'https://other.example/contatos.html'},{href:'contatos.html',download:''},{href:'../../site-visat/consulta-sites.html','data-fichas-oficial':''},{href:'../../site-visat/consulta-sites.html','data-fichas-replica':''},{href:'contatos.html','data-visat-destino-direto':''}]) {n=navigationFixture({blockTop:true});e=click(n.f,n.f.make('a',attrs));equal(n.calls.top.length+n.calls.opened.length,0);equal(e.defaultPrevented,false);}
 for(const options of [{standalone:true},{mode:'?modo=replica'}]) {n=navigationFixture(options);e=click(n.f,n.f.make('a',{href:'contatos.html'}));equal(n.calls.top.length+n.calls.opened.length,0);equal(e.defaultPrevented,false);}
 console.log('PASS: '+assertions+' assertions — routes, modes, shadow DOM, search, trusted-click navigation, sandbox fallback and popup-blocked recovery.');
})().catch(err=>{console.error(err);process.exitCode=1;});
