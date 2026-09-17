import type { PracticeEngine } from './engine';
import { selected, type Hand, type Score, type Settings } from './types';

export interface ProgressRecord { key: string; hash: string; hand: Hand; title: string; solved: number[]; mistakes: number; seconds: number; settings: Settings; updated: number }
export class ProgressStore {
  private database?: Promise<IDBDatabase>;
  private open(): Promise<IDBDatabase> {
    return this.database ??= new Promise((resolve,reject) => {
      let settled=false;
      const timeout=setTimeout(()=>{settled=true;reject(new Error('Lokaler Speicher antwortet nicht.'));},3000);
      let request: IDBOpenDBRequest;
      try { request=indexedDB.open('klavierzeit',1); } catch(error) {clearTimeout(timeout);reject(error);return;}
      request.onupgradeneeded=()=>{request.result.createObjectStore('progress',{keyPath:'key'});};
      request.onsuccess=()=>{clearTimeout(timeout);if(settled)request.result.close();else resolve(request.result);};
      request.onerror=()=>{clearTimeout(timeout);reject(request.error);};
      request.onblocked=()=>{clearTimeout(timeout);settled=true;reject(new Error('Bitte andere Klavierzeit-Tabs schließen.'));};
    });
  }
  async read(hash: string): Promise<ProgressRecord[]> {
    const db=await this.open();
    return new Promise((resolve,reject)=>{const request=db.transaction('progress','readonly').objectStore('progress').getAll();request.onsuccess=()=>resolve((request.result as ProgressRecord[]).filter(record=>record.hash===hash));request.onerror=()=>reject(request.error);});
  }
  async write(record: ProgressRecord): Promise<void> {
    const db=await this.open();
    return new Promise((resolve,reject)=>{const tx=db.transaction('progress','readwrite');tx.objectStore('progress').put(record);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
  }
  async clear(hash: string): Promise<void> {
    const records=await this.read(hash);const db=await this.open();
    return new Promise((resolve,reject)=>{const tx=db.transaction('progress','readwrite');for(const record of records)tx.objectStore('progress').delete(record.key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
  }
}
export function restoreSettings(value: Partial<Settings>, score: Score): Settings {
  const clamp=(n:number,min:number,max:number)=>Number.isFinite(n)?Math.min(max,Math.max(min,Math.round(n))):min;
  const from=clamp(Number(value.from),0,score.measures.length-1);
  return {bpm:clamp(Number(value.bpm)||score.bpm,30,240),hand:['both','right','left'].includes(value.hand??'')?value.hand!:'both',rightStaff:clamp(Number(value.rightStaff),0,score.staves.length-1),leftStaff:clamp(Number(value.leftStaff??1),0,score.staves.length-1),loop:value.loop===true,from,to:clamp(Number(value.to??score.measures.length-1),from,score.measures.length-1)};
}

export class LocalProgress {
  private store=new ProgressStore();
  private records=new Map<Hand,ProgressRecord>();
  private dirty=new Set<Hand>();
  private generation=0;
  private interacted=false;
  private available=true;
  private pending=Promise.resolve();
  private lastActivity=0;
  private lastTick=Date.now();
  private lastSave=0;
  ready=false;
  private status: HTMLElement;
  constructor(host: HTMLElement,private getEngine:()=>PracticeEngine|undefined,private getBusy:()=>boolean,private applySettings:(settings:Settings)=>void) {
    const section=document.createElement('section');section.className='control-section';
    section.innerHTML=`<h2>Dein Fortschritt</h2><div class="stats"><div><strong id="completed-progress">0 / 0</strong><span>Einsätze geschafft</span></div><div><strong id="mistakes-progress">0</strong><span>Falsche Töne</span></div><div><strong id="time-progress">0:00</strong><span>Übezeit</span></div></div><p id="progress-status" class="hint" role="status">Wird lokal in diesem Browser gespeichert.</p><button id="clear-progress" class="text-button">Fortschritt dieses Stücks löschen</button>`;
    host.append(section);this.status=section.querySelector('#progress-status')!;
    section.querySelector('#clear-progress')!.addEventListener('click',()=>{
      const engine=this.getEngine();if(!engine||!confirm('Fortschritt für dieses Stück und alle Hände löschen? Die Noten bleiben erhalten.'))return;
      void this.clear(engine.score.hash).catch(()=>this.failed());
    });
    setInterval(()=>this.tick(),1000);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)void this.flush();});
    window.addEventListener('pagehide',()=>{void this.flush();});
  }
  private blank(engine:PracticeEngine,hand:Hand):ProgressRecord {return {key:`${engine.score.hash}:${hand}`,hash:engine.score.hash,hand,title:engine.score.title,solved:[],mistakes:0,seconds:0,settings:{...engine.settings,hand},updated:0};}
  async loaded():Promise<void> {
    void this.flush();const generation=++this.generation;const engine=this.getEngine();if(!engine)return;
    this.records=new Map(['both','right','left'].map(hand=>[hand as Hand,this.blank(engine,hand as Hand)]));this.dirty.clear();this.interacted=false;this.ready=false;this.lastActivity=0;
    engine.onResult=correct=>{
      const record=this.records.get(engine.settings.hand)!;
      if(correct&&engine.current)record.solved=[...new Set([...record.solved,engine.current.cursorIndex])];
      if(!correct)record.mistakes++;this.change();
    };
    this.update();
    try {
      const saved=await this.store.read(engine.score.hash);
      if(generation!==this.generation)return;
      for(const old of saved){const current=this.records.get(old.hand);if(!current)continue;current.solved=[...new Set([...(old.solved??[]),...current.solved])];current.mistakes+=(old.mistakes||0);current.seconds+=(old.seconds||0);}
      const latest=saved.sort((a,b)=>b.updated-a.updated)[0];
      if(latest&&!this.interacted)this.applySettings(restoreSettings(latest.settings,engine.score));
      this.status.textContent='Lokal gespeichert · zählt je Stück und Hand. Ohne Übeaktivität pausiert die Zeit nach 30 Sekunden.';
    }catch{this.failed();}
    finally{if(generation===this.generation){this.ready=true;this.update();}}
  }
  change():void {
    const engine=this.getEngine();if(!engine)return;const record=this.records.get(engine.settings.hand);if(!record)return;
    this.interacted=true;this.lastActivity=Date.now();record.settings={...engine.settings};record.updated=Date.now();this.dirty.add(record.hand);this.update();
  }
  private update():void {
    const engine=this.getEngine();const record=engine&&this.records.get(engine.settings.hand);if(!engine||!record)return;
    const eligible=engine.score.steps.filter(step=>step.notes.some(n=>selected(n,engine.settings))).map(step=>step.cursorIndex);
    document.getElementById('completed-progress')!.textContent=`${record.solved.filter(id=>eligible.includes(id)).length} / ${eligible.length}`;
    document.getElementById('mistakes-progress')!.textContent=String(record.mistakes);
    const seconds=Math.floor(record.seconds);document.getElementById('time-progress')!.textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  }
  private tick():void {
    const now=Date.now();const seconds=Math.min(2,(now-this.lastTick)/1000);this.lastTick=now;
    const engine=this.getEngine();const record=engine&&this.records.get(engine.settings.hand);
    if(engine&&record&&!this.getBusy()&&!document.hidden&&(engine.playing||(engine.mode==='step'&&!engine.finished&&now-this.lastActivity<30000))){record.seconds+=seconds;record.updated=now;this.dirty.add(record.hand);this.update();}
    if(now-this.lastSave>1000)void this.flush();
  }
  async flush():Promise<void> {
    if(!this.available||!this.ready)return;
    const snapshots=[...this.dirty].map(hand=>structuredClone(this.records.get(hand)!));this.dirty.clear();this.lastSave=Date.now();
    this.pending=this.pending.then(async()=>{for(const record of snapshots)await this.store.write(record);}).catch(()=>this.failed());await this.pending;
  }
  private failed():void{this.available=false;this.status.textContent='Lokaler Speicher nicht verfügbar. Du kannst weiter üben; dieser Fortschritt wird nicht gespeichert.';}
  private async clear(hash:string):Promise<void>{await this.flush();await this.store.clear(hash);const engine=this.getEngine();if(engine?.score.hash===hash){for(const hand of ['both','right','left']as const)this.records.set(hand,this.blank(engine,hand));this.dirty.clear();this.update();this.status.textContent='Fortschritt dieses Stücks gelöscht. Neue Übungen werden wieder gespeichert.';}}
}
