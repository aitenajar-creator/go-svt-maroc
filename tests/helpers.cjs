const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');
function between(text, start, end) {
  const first = text.indexOf(start), last = text.indexOf(end, first + start.length);
  if (first < 0 || last < 0) throw new Error('Source boundary not found: ' + start);
  return text.slice(first, last);
}
function node() {
  const classes = new Set(), handlers = {}, attrs = {};
  return { dataset: {}, style: {}, children: [], hidden: false, isConnected: true, value: '', textContent: '', innerHTML: '', handlers,
    classList: { add: (...names) => names.forEach(n => classes.add(n)), remove: (...names) => names.forEach(n => classes.delete(n)), contains: n => classes.has(n), toggle(n, on) { on = on === undefined ? !classes.has(n) : on; on ? classes.add(n) : classes.delete(n); return on; } },
    addEventListener(type, fn) { handlers[type] = fn; }, setAttribute(k,v) { attrs[k]=String(v); }, getAttribute:k=>attrs[k]||null, removeAttribute:k=>delete attrs[k],
    appendChild(child) { this.children.push(child); return child; }, append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children=children; this.innerHTML=''; this.textContent=''; },
    querySelector:()=>null, querySelectorAll:()=>[], focus(){}, click(){ if(handlers.click) return handlers.click({target:this}); }, reset(){this.value='';}, close(){this.open=false;}, remove(){this.isConnected=false;}
  };
}
function browser(extra={}) {
  const data=new Map(), events=new Map(), nodes=new Map(), logs=[];
  const document={readyState:'loading',head:node(),body:node(),documentElement:Object.assign(node(),{lang:'fr',dir:'ltr'}),
    getElementById:id=>nodes.get(id)||null, querySelector:()=>null, querySelectorAll:()=>[], createElement:()=>node(),
    addEventListener(type,fn){if(!events.has(type))events.set(type,[]);events.get(type).push(fn);},
    dispatchEvent(event){for(const fn of events.get(event.type)||[])fn(event);}
  };
  const context={document,navigator:{},console:{log:(...a)=>logs.push(a),warn:(...a)=>logs.push(a),error:(...a)=>logs.push(a)},
    location:{href:'http://fixture.invalid/index.html',origin:'http://fixture.invalid',pathname:'/index.html',search:'',hash:'',reload(){}},
    URL,URLSearchParams,Promise,Date,Request,Response,setTimeout,clearTimeout,crypto:{randomUUID},
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
    localStorage:{getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),clear:()=>data.clear(),key:i=>[...data.keys()][i],get length(){return data.size;}},
    addEventListener(){},fetch(){throw new Error('Unexpected network request in unit test');},
    ...extra};
  context.window=context;
  vm.createContext(context);
  return {context,nodes,events,logs,load:name=>vm.runInContext(source(name),context,{filename:name}),run:code=>vm.runInContext(code,context)};
}
function query(result, operations=[]) {
  const builder={};
  for(const method of ['select','eq','in','is','not','order','range','limit','upsert','insert','update','delete'])builder[method]=(...args)=>{operations.push([method,...args]);return builder;};
  const resolve=()=>typeof result==='function'?result(operations):result;
  builder.then=(yes,no)=>Promise.resolve().then(resolve).then(yes,no);
  builder.maybeSingle=()=>Promise.resolve().then(resolve);
  builder.single=()=>Promise.resolve().then(resolve);
  return builder;
}
const flush=async()=>{for(let i=0;i<6;i++)await new Promise(setImmediate);};
module.exports={root,source,between,browser,node,query,flush,vm};
