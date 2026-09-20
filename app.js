(() => {
  "use strict";

  // ============================================================
  // Logic AI Level 2
  // - Brain.js local intent classifier (no pretrained language model)
  // - Wikipedia concept synthesis
  // - Emoji emotion recognition
  // - 4 models: Flash / Thinking / Media View / Work
  // - Media OCR with Tesseract.js + approximate Wikimedia color matching
  // - Local Work sandbox: IndexedDB files, timer, calculator, browser
  // ============================================================

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const state = {
    model: localStorage.getItem("logic-ai-model") || "flash",
    network: null,
    brainReady: false,
    isBusy: false,
    voices: [],
    emotion: { name: "Neutral", emoji: "🙂", tone: "neutral" },
    customTraining: loadJSON("logic-ai-training", []),
    chats: loadJSON("logic-ai-chats", []),
    activeChatId: localStorage.getItem("logic-ai-active-chat") || "",
    lastTopic: "",
    timerId: null,
    timerEnd: 0,
    currentWorkApp: "storage",
    storageDB: null,
    tesseractBusy: false
  };

  const els = {
    brainDot: $("#brainDot"), brainStatus: $("#brainStatus"),
    modelTitle: $("#modelTitle"), modelEyebrow: $("#modelEyebrow"),
    emotionPill: $("#emotionPill"), chatWrap: $("#chatWrap"),
    mediaPanel: $("#mediaPanel"), workPanel: $("#workPanel"), trainingPanel: $("#trainingPanel"),
    composer: $("#composer"), userInput: $("#userInput"), sendBtn: $("#sendBtn"),
    composerHint: $("#composerHint"), charCount: $("#charCount"),
    ttsToggle: $("#ttsToggle"), analysisToggle: $("#analysisToggle"),
    clearBtn: $("#clearBtn"), stopVoiceBtn: $("#stopVoiceBtn"),
    newChatBtn: $("#newChatBtn"), chatHistory: $("#chatHistory"),
    trainingBtn: $("#trainingBtn"), closeTraining: $("#closeTraining"),
    trainingText: $("#trainingText"), trainingIntent: $("#trainingIntent"),
    addTrainingBtn: $("#addTrainingBtn"), resetTrainingBtn: $("#resetTrainingBtn"), trainingStats: $("#trainingStats"),
    mediaInput: $("#mediaInput"), mediaDrop: $("#mediaDrop"), mediaPreview: $("#mediaPreview"),
    mediaProgressWrap: $("#mediaProgressWrap"), mediaProgressLabel: $("#mediaProgressLabel"),
    mediaProgressBar: $("#mediaProgressBar"), mediaResult: $("#mediaResult"),
    storageInput: $("#storageInput"), storageList: $("#storageList"),
    clockDisplay: $("#clockDisplay"), clockAmount: $("#clockAmount"), clockUnit: $("#clockUnit"),
    clockStart: $("#clockStart"), clockStop: $("#clockStop"),
    calcInput: $("#calcInput"), calcRun: $("#calcRun"), calcResult: $("#calcResult"),
    browserUrl: $("#browserUrl"), browserGo: $("#browserGo"), browserRead: $("#browserRead"),
    browserFrame: $("#browserFrame"), browserNotice: $("#browserNotice"), browserText: $("#browserText")
  };

  const MODEL_META = {
    flash: { title: "Flash 1.0", eyebrow: "FAST CONCEPT SYNTHESIS", hint: "Tokeniza conceptos y sintetiza una respuesta breve." },
    thinking: { title: "Thinking 1.0", eyebrow: "DEEPER MULTI-CONCEPT ANALYSIS", hint: "Consulta más contexto y muestra pasos de análisis verificables." },
    media: { title: "Media View 1.0", eyebrow: "VISUAL ANALYSIS", hint: "Carga una foto o video en el panel de Media View." },
    work: { title: "Work 1.0", eyebrow: "LOCAL AGENT SANDBOX", hint: "Pídele calcular, iniciar un timer, abrir un enlace o gestionar archivos." }
  };

  const INTENTS = ["greeting","wellbeing","definition","explanation","person","time","conversation","search","math","timer","browser"];
  const BASE_TRAINING = [
    ["hola","greeting"],["buenas","greeting"],["hey logic","greeting"],["buen dia","greeting"],
    ["como estas","wellbeing"],["que tal estas","wellbeing"],["como te va","wellbeing"],
    ["que es una calculadora","definition"],["que significa gravedad","definition"],["define algoritmo","definition"],
    ["como funciona una calculadora","explanation"],["por que marte es rojo","explanation"],["explicame internet","explanation"],
    ["quien fue einstein","person"],["quien es ada lovelace","person"],["biografia de tesla","person"],
    ["cuando nacio einstein","time"],["en que ano ocurrio","time"],
    ["gracias","conversation"],["genial","conversation"],["cuentame mas","conversation"],["quien eres","conversation"],
    ["busca wikipedia sobre saturno","search"],["investiga volcanes","search"],["quiero informacion sobre japon","search"],
    ["calcula 25 por 4","math"],["cuanto es 80 dividido 5","math"],["resuelve 2 mas 2","math"],
    ["pon un timer de 5 minutos","timer"],["temporizador 30 segundos","timer"],
    ["abre https://example.com","browser"],["ve a wikipedia.org","browser"]
  ];

  const VOCABULARY = [...new Set(BASE_TRAINING.flatMap(([t]) => normalize(t).split(" ")).filter(Boolean))];
  const STOP = new Set("a al algo algun alguna algunas algunos ante bajo cabe con contra cual cuales cuando de del desde donde durante e el ella ellas ello ellos en entre era es esa esas ese eso esos esta estas este esto estos fue ha hacia hay la las le les lo los mas me mi mis mucho muy ni no nos o para pero por porque que quien quienes se sin sobre su sus te tu tus un una unas unos y ya yo quiero quieres diga digas dime decir acerca funciona funcionar puede puedes favor porfa".split(" "));

  const EMOTIONS = [
    { name:"Feliz", emoji:"😄", tone:"happy", tests:[/😄|😁|😊|😀|😃|🥰|😍|❤️|💚|✨|🎉|😎/u] },
    { name:"Entusiasmado", emoji:"🤩", tone:"excited", tests:[/🤩|🔥|🚀|💪|🙌|👏|⚡/u] },
    { name:"Triste", emoji:"😔", tone:"sad", tests:[/😢|😭|😔|😞|💔|🥺/u] },
    { name:"Enojado", emoji:"😠", tone:"angry", tests:[/😡|😠|🤬|💢|👿/u] },
    { name:"Preocupado", emoji:"😟", tone:"worried", tests:[/😟|😰|😨|😱|😬|😓/u] },
    { name:"Confundido", emoji:"🤔", tone:"confused", tests:[/🤔|😕|🫤|❓|❔/u] },
    { name:"Divertido", emoji:"😂", tone:"amused", tests:[/😂|🤣|😆|😹/u] }
  ];

  const TOPIC_EMOJIS = [
    [/espacio|planeta|marte|saturno|estrella|galax|universo|luna|sol/i,"🪐"],
    [/program|codigo|javascript|html|css|software|computador|algoritmo/i,"💻"],
    [/matemat|calculadora|numero|ecuacion|geometr/i,"🧮"],
    [/animal|perro|gato|ave|pez|mamifero/i,"🐾"],
    [/musica|cancion|piano|guitarra|artista/i,"🎵"],
    [/viaje|pais|ciudad|turismo|vuelo/i,"✈️"],
    [/ciencia|fisica|quimica|biologia|celula/i,"🔬"],
    [/historia|guerra|imperio|revolucion/i,"📜"],
    [/comida|receta|cocina|alimento/i,"🍽️"],
    [/deporte|futbol|tenis|baloncesto/i,"⚽"]
  ];

  function normalize(text) {
    return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  }

  // Requirement: tokenization between every space and symbol.
  function tokenizeAll(text) {
    return String(text || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().split(/[^\p{L}\p{N}]+/u).map(x => x.trim()).filter(Boolean);
  }

  function contentTokens(text) {
    return [...new Set(tokenizeAll(text).filter(t => t.length > 2 && !STOP.has(t) && !/^\d+$/.test(t)))];
  }

  function conceptGroups(text) {
    const all = tokenizeAll(text);
    const meaningful = all.filter(t => t.length > 2 && !STOP.has(t));
    const groups = [];
    for (let n = 3; n >= 2; n--) {
      for (let i = 0; i <= meaningful.length - n; i++) {
        const g = meaningful.slice(i, i+n).join(" ");
        if (!groups.includes(g)) groups.push(g);
      }
    }
    meaningful.forEach(t => { if (!groups.includes(t)) groups.push(t); });
    return groups.slice(0, 8);
  }

  function vectorize(text) {
    const words = new Set(tokenizeAll(text));
    const v = {};
    VOCABULARY.forEach(w => v[w] = words.has(w) ? 1 : 0);
    const n = normalize(text);
    v.__question = /[?¿]/.test(text) ? 1 : 0;
    v.__why = /^(por que|como funciona|explica)/.test(n) ? 1 : 0;
    v.__what = /^(que es|que significa|define)/.test(n) ? 1 : 0;
    v.__who = /^(quien)/.test(n) ? 1 : 0;
    v.__when = /^(cuando|en que ano|en que fecha)/.test(n) ? 1 : 0;
    v.__calc = /\b(calcula|cuanto es|resuelve)\b/.test(n) ? 1 : 0;
    v.__timer = /\b(timer|temporizador|cronometro)\b/.test(n) ? 1 : 0;
    v.__url = /https?:\/\//i.test(text) ? 1 : 0;
    return v;
  }

  function oneHot(intent) { const o={}; INTENTS.forEach(i => o[i] = i===intent ? 1 : 0); return o; }

  function trainBrain() {
    const all = [...BASE_TRAINING, ...state.customTraining.map(x => [x.text,x.intent])];
    if (!window.brain?.NeuralNetwork) {
      state.brainReady = false; els.brainDot.className="dot error"; els.brainStatus.textContent="Brain.js no cargó · reglas activas"; updateTrainingStats(); return;
    }
    try {
      const net = new brain.NeuralNetwork({hiddenLayers:[20,14],activation:"sigmoid"});
      net.train(all.map(([text,intent]) => ({input:vectorize(text),output:oneHot(intent)})), {iterations:1600,errorThresh:.009,learningRate:.25,log:false});
      state.network=net; state.brainReady=true; els.brainDot.className="dot ready"; els.brainStatus.textContent="Brain.js entrenado localmente";
    } catch (e) {
      console.warn(e); state.brainReady=false; els.brainDot.className="dot error"; els.brainStatus.textContent="Reglas de respaldo activas";
    }
    updateTrainingStats();
  }

  function heuristicIntent(text) {
    const n=normalize(text);
    if (/^(hola|buenas|hey|holi|buen dia)/.test(n)) return "greeting";
    if (/\b(como estas|que tal estas|como te va)\b/.test(n)) return "wellbeing";
    if (/\b(calcula|cuanto es|resuelve)\b/.test(n) || /^[\d\s+\-*/().^%]+$/.test(text.trim())) return "math";
    if (/\b(timer|temporizador|cronometro)\b/.test(n)) return "timer";
    if (/https?:\/\//i.test(text) || /^(abre|navega|ve a)\b/.test(n)) return "browser";
    if (/^(por que|explica|explicame|como funciona|como se forma)/.test(n)) return "explanation";
    if (/^(que es|que significa|define)/.test(n)) return "definition";
    if (/^(quien es|quien fue|quien era|biografia)/.test(n)) return "person";
    if (/^(cuando|en que ano|en que fecha)/.test(n)) return "time";
    if (/\b(busca|investiga|wikipedia|informacion)\b/.test(n)) return "search";
    return "conversation";
  }

  function classifyIntent(text) {
    const h=heuristicIntent(text);
    if (!state.brainReady || !state.network) return {intent:h,confidence:.55,engine:"reglas"};
    try {
      const out=state.network.run(vectorize(text));
      const [intent,confidence]=Object.entries(out).sort((a,b)=>b[1]-a[1])[0] || [h,.5];
      const strong = ["math","timer","browser"].includes(h) || /^(que es|por que|como funciona|quien|cuando|hola)/.test(normalize(text));
      return {intent:strong?h:(confidence>.4?intent:h),confidence,engine:strong?"Brain.js + reglas":"Brain.js"};
    } catch { return {intent:h,confidence:.5,engine:"reglas"}; }
  }

  function detectEmotion(text) {
    for (const e of EMOTIONS) if (e.tests.some(re => re.test(text))) return e;
    return { name:"Neutral", emoji:"🙂", tone:"neutral" };
  }

  function topicEmoji(text) {
    for (const [re,emoji] of TOPIC_EMOJIS) if (re.test(text)) return emoji;
    return "💡";
  }

  function emotionLead(emotion) {
    if (emotion.tone==="sad") return "Entiendo 😔. ";
    if (emotion.tone==="worried") return "Entiendo la preocupación 😟. ";
    if (emotion.tone==="angry") return "Veo que esto te molesta 😠. ";
    if (emotion.tone==="excited") return "¡Sí! 🤩 ";
    if (emotion.tone==="happy") return "¡Claro! 😄 ";
    if (emotion.tone==="confused") return "Claro, lo ordeno 🤔: ";
    if (emotion.tone==="amused") return "😂 Dale. ";
    return "Claro. ";
  }

  async function wikiSearch(query, limit=5) {
    const p=new URLSearchParams({action:"query",list:"search",srsearch:query,srlimit:String(limit),srprop:"snippet|wordcount",format:"json",origin:"*"});
    const r=await fetch(`https://es.wikipedia.org/w/api.php?${p}`); if(!r.ok) throw new Error(`Wikipedia ${r.status}`); const d=await r.json();
    return (d.query?.search||[]).map(x=>({title:x.title,pageid:x.pageid,snippet:stripHtml(x.snippet||"")}));
  }

  async function wikiExtract(titles, sentences=9) {
    if(!titles.length) return [];
    const p=new URLSearchParams({action:"query",prop:"extracts|info",exintro:"1",explaintext:"1",exsentences:String(sentences),inprop:"url",redirects:"1",titles:titles.join("|"),format:"json",origin:"*"});
    const r=await fetch(`https://es.wikipedia.org/w/api.php?${p}`); if(!r.ok) throw new Error(`Wikipedia ${r.status}`); const d=await r.json();
    return Object.values(d.query?.pages||{}).filter(x=>!x.missing).map(x=>({title:x.title,extract:(x.extract||"").trim(),url:x.fullurl||""}));
  }

  function stripHtml(html){const d=document.createElement("div");d.innerHTML=html;return d.textContent||"";}
  function splitSentences(text){return String(text||"").split(/(?<=[.!?])\s+/).map(x=>x.trim()).filter(x=>x.length>20);}

  function sentenceScore(sentence, tokens, groups, index=0) {
    const s=normalize(sentence); let score=0;
    tokens.forEach(t=>{if(s.includes(t)) score+=2.4;});
    groups.forEach(g=>{if(g.includes(" ") && s.includes(g)) score+=5;});
    if (/\b(consiste|funcion|funciona|permite|utiliza|mediante|se usa|principal|proceso|resultado|debido|porque)\b/.test(s)) score+=2.5;
    if(index===0) score+=1.5;
    if(sentence.length>=55 && sentence.length<=280) score+=1;
    return score;
  }

  function selectConceptFragments(pages, userText, maxSentences=3) {
    const tokens=contentTokens(userText), groups=conceptGroups(userText);
    const candidates=[];
    pages.forEach(page=>splitSentences(page.extract).forEach((sentence,index)=>candidates.push({sentence,page,score:sentenceScore(sentence,tokens,groups,index)})));
    candidates.sort((a,b)=>b.score-a.score);
    const picked=[]; const covered=new Set();
    for(const c of candidates){
      const hits=tokens.filter(t=>normalize(c.sentence).includes(t));
      const newHits=hits.filter(t=>!covered.has(t));
      if(picked.length===0 || newHits.length || c.score>6){picked.push(c); hits.forEach(t=>covered.add(t));}
      if(picked.length>=maxSentences) break;
    }
    return picked;
  }

  function cleanSentenceForSynthesis(sentence) {
    return sentence.replace(/\[[^\]]+\]/g,"").replace(/\s+/g," ").trim();
  }

  // Combines 2+ concepts into a new short answer rather than copying a full article.
  function synthesizeFromFragments(userText, classification, fragments, emotion) {
    if(!fragments.length) return "No encontré suficiente información para combinar una respuesta útil.";
    const topic=bestTopicFromQuery(userText, fragments.map(f=>f.page.title));
    const emoji=topicEmoji(`${userText} ${topic}`);
    const parts=fragments.map(f=>cleanSentenceForSynthesis(f.sentence));
    const clauses=[];

    // Extract compact definitional clauses from independent sentences.
    for(const part of parts){
      const first=part.split(/[;:]/)[0].trim();
      if(first.length>25 && first.length<260 && !clauses.some(c=>normalize(c)===normalize(first))) clauses.push(first);
      if(clauses.length>=3) break;
    }

    let core="";
    if(clauses.length===1) core=clauses[0];
    else if(clauses.length===2) core=`${clauses[0].replace(/[.]$/,"")}; además, ${lowerFirst(clauses[1])}`;
    else core=`${clauses[0].replace(/[.]$/,"")}; ${lowerFirst(clauses[1]).replace(/[.]$/,"")}, y ${lowerFirst(clauses[2])}`;

    core=core.replace(/\s+/g," ").trim();
    if(!/[.!?]$/.test(core)) core+=".";

    const lead=emotionLead(emotion);
    if(classification.intent==="explanation") return `${lead}${emoji} ${core} Si quieres, puedo explorar más a fondo cómo funciona o darte un ejemplo.`;
    if(classification.intent==="definition") return `${lead}${emoji} ${core} Si quieres, puedo ampliar la explicación.`;
    return `${lead}${emoji} ${core}`;
  }

  function bestTopicFromQuery(text, titles=[]) {
    const tokens=contentTokens(text);
    if(titles.length){
      let best=titles[0],score=-1;
      for(const title of titles){let s=0;const nt=normalize(title);tokens.forEach(t=>{if(nt.includes(t))s+=3;});if(s>score){best=title;score=s;}}
      return best;
    }
    return tokens.slice(-3).join(" ") || normalize(text);
  }

  async function conceptKnowledge(userText, classification, model) {
    const tokens=contentTokens(userText);
    const groups=conceptGroups(userText);
    const remembered=inferRememberedTopic(userText);
    const queryParts=[...groups.filter(g=>g.includes(" ")), ...tokens].slice(0, model==="thinking"?5:3);
    if(remembered && tokens.length<2) queryParts.unshift(remembered);
    const uniqueQueries=[...new Set(queryParts.filter(Boolean))];
    const steps=[];
    steps.push(`Tokenicé ${tokenizeAll(userText).length} palabras/símbolos útiles y detecté ${tokens.length} conceptos de contenido.`);
    if(groups.length) steps.push(`Agrupé conceptos relacionados: ${groups.slice(0,4).join(" · ")}.`);

    const searchLimit=model==="thinking"?4:3;
    const allSearch=[];
    for(const q of uniqueQueries.slice(0, model==="thinking"?4:2)){
      try { const r=await wikiSearch(q,searchLimit); r.forEach(x=>allSearch.push(x)); } catch {}
    }
    const dedup=[...new Map(allSearch.map(x=>[x.title,x])).values()].slice(0, model==="thinking"?7:4);
    if(!dedup.length) throw new Error("Sin resultados de Wikipedia");
    steps.push(`Encontré ${dedup.length} artículos candidatos y comparé cuáles cubren más conceptos de tu frase.`);

    const pages=await wikiExtract(dedup.map(x=>x.title), model==="thinking"?10:7);
    const fragments=selectConceptFragments(pages,userText,model==="thinking"?4:2);
    steps.push(`Seleccioné ${fragments.length} fragmentos de distintas partes y los combiné en una respuesta nueva.`);
    if(model==="thinking") steps.push(`Contrasté coincidencias entre: ${fragments.map(f=>f.page.title).filter((x,i,a)=>a.indexOf(x)===i).join(" · ")}.`);

    return { pages, fragments, steps, tokens, groups, topic:bestTopicFromQuery(userText,pages.map(p=>p.title)) };
  }

  function localConversation(text, classification, emotion) {
    const n=normalize(text);
    if(classification.intent==="greeting") return `${emotionLead(emotion)}👋 Soy Logic AI. ¿Qué quieres explorar?`;
    if(classification.intent==="wellbeing") return `¡Muy bien! 😄 Estoy listo. ¿Cómo estás tú?`;
    if(/\b(gracias|muchas gracias)\b/.test(n)) return "¡De nada! 😄";
    if(/\b(quien eres|que eres)\b/.test(n)) return "Soy Logic AI: combino Brain.js, reglas, memoria local y conocimiento de Wikipedia. No soy un LLM preentrenado.";
    if(/\b(cuentame mas|continua|sigue|que mas)\b/.test(n) && state.lastTopic) return null;
    if(classification.intent==="conversation" && contentTokens(text).length<2) return `${emotionLead(emotion)}Te escucho. Puedes preguntarme algo concreto o continuar con el tema anterior.`;
    return null;
  }

  async function answerText(text) {
    const emotion=detectEmotion(text); state.emotion=emotion; updateEmotionUI();
    const classification=classifyIntent(text);
    const local=localConversation(text,classification,emotion);
    if(local) return {text:local,classification,emotion,steps:[],sources:[],tokens:tokenizeAll(text),topic:""};

    if(state.model==="work") return handleWorkAgent(text,classification,emotion);

    try {
      const knowledge=await conceptKnowledge(text,classification,state.model);
      state.lastTopic=knowledge.topic;
      const response=synthesizeFromFragments(text,classification,knowledge.fragments,emotion);
      const sources=[...new Map(knowledge.fragments.map(f=>[f.page.title,f.page])).values()];
      return {text:response,classification,emotion,steps:knowledge.steps,sources,tokens:tokenizeAll(text),topic:knowledge.topic,groups:knowledge.groups};
    } catch(e){
      console.warn(e);
      return {text:`${emotionLead(emotion)}No pude obtener suficiente información de Wikipedia ahora mismo. Mi clasificación local sigue activa, pero esta pregunta necesita conocimiento externo.`,classification,emotion,steps:["La búsqueda externa no devolvió datos utilizables."],sources:[],tokens:tokenizeAll(text),topic:"",error:true};
    }
  }

  // --------------------------- Memory ---------------------------
  function nowISO(){return new Date().toISOString();}
  function ensureChat(){
    let c=state.chats.find(x=>x.id===state.activeChatId);
    if(!c){c={id:`chat-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,title:"Nuevo chat",createdAt:nowISO(),updatedAt:nowISO(),messages:[]};state.chats.unshift(c);state.activeChatId=c.id;persistChats();}
    return c;
  }
  function persistChats(){
    state.chats=state.chats.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0,30).map(c=>({...c,messages:(c.messages||[]).slice(-100)}));
    saveJSON("logic-ai-chats",state.chats);localStorage.setItem("logic-ai-active-chat",state.activeChatId||"");renderHistory();
  }
  function saveMessage(role,text,extra={}){const c=ensureChat();c.messages.push({role,text,createdAt:nowISO(),...extra});c.updatedAt=nowISO();if(c.title==="Nuevo chat"&&role==="user")c.title=text.replace(/\s+/g," ").slice(0,40);persistChats();}
  function createNewChat(){const c={id:`chat-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,title:"Nuevo chat",createdAt:nowISO(),updatedAt:nowISO(),messages:[]};state.chats.unshift(c);state.activeChatId=c.id;state.lastTopic="";persistChats();renderActiveChat();}
  function renderHistory(){if(!els.chatHistory)return;els.chatHistory.innerHTML="";state.chats.slice(0,12).forEach(c=>{const b=document.createElement("button");b.className=`history-item${c.id===state.activeChatId?" active":""}`;b.textContent=c.title||"Chat";b.onclick=()=>{state.activeChatId=c.id;persistChats();renderActiveChat();};els.chatHistory.appendChild(b);});}
  function inferRememberedTopic(text){
    const tokens=contentTokens(text);if(state.lastTopic&&tokens.length<2)return state.lastTopic;
    let best={topic:"",score:0};
    for(const c of state.chats) for(const m of c.messages||[]){if(!m.topic)continue;let s=0;const h=normalize(`${m.text} ${m.topic}`);tokens.forEach(t=>{if(h.includes(t))s+=2;});if(s>best.score)best={topic:m.topic,score:s};}
    return best.topic;
  }
  function relatedSuggestions(topic){if(!topic)return[];return [`¿Cómo funciona ${topic}?`,`¿Qué datos curiosos hay sobre ${topic}?`,`¿Con qué se relaciona ${topic}?`];}

  // --------------------------- Rendering ---------------------------
  function welcomeHtml(){return `<div class="message ai"><div class="avatar">L</div><div class="bubble"><div class="message-meta">Logic AI · ${MODEL_META[state.model].title}</div><p>¡Hola! 👋 Puedo tokenizar tu frase, combinar varios conceptos y usar el modelo que elijas. Prueba: “quiero que me digas cómo funciona una calculadora”.</p><div class="chips"><button class="chip" data-prompt="Quiero que me digas cómo funciona una calculadora.">🧮 ¿Cómo funciona una calculadora?</button><button class="chip" data-prompt="¿Por qué Marte es rojo y qué tiene que ver el hierro?">🪐 Combinar conceptos</button></div></div></div>`;}
  function renderActiveChat(){const c=ensureChat();els.chatWrap.innerHTML="";const last=[...(c.messages||[])].reverse().find(m=>m.topic);state.lastTopic=last?.topic||"";if(!c.messages.length){els.chatWrap.innerHTML=welcomeHtml();return;}for(const m of c.messages){if(m.role==="user")renderUser(m.text,false);else renderStoredAI(m);}scrollBottom();}
  function renderUser(text,save=true){const w=document.createElement("div");w.className="message user";w.innerHTML=`<div class="bubble"><div class="message-meta">Tú</div><p>${escapeHtml(text)}</p></div><div class="avatar">T</div>`;els.chatWrap.appendChild(w);if(save)saveMessage("user",text);scrollBottom();}
  function renderStoredAI(m){renderAI({...m,classification:m.classification||{intent:"conversation",confidence:0,engine:"memoria"}},false);}
  function renderAI(result,save=true){
    const w=document.createElement("div");w.className="message ai";const bubble=document.createElement("div");bubble.className="bubble";
    bubble.innerHTML=`<div class="message-meta">Logic AI · ${MODEL_META[result.model||state.model].title}</div><p>${escapeHtml(result.text)}</p>`;
    if(result.sources?.length){result.sources.slice(0,4).forEach(s=>{const a=document.createElement("a");a.className="source-link";a.href=s.url;a.target="_blank";a.rel="noopener noreferrer";a.textContent=`Fuente: Wikipedia · ${s.title} ↗`;bubble.appendChild(a);bubble.appendChild(document.createElement("br"));});}
    if(state.model==="thinking" && result.steps?.length){const d=document.createElement("div");d.className="thought-panel";d.innerHTML=`<strong>Pasos de análisis visibles</strong><ol>${result.steps.map(s=>`<li>${escapeHtml(s)}</li>`).join("")}</ol>`;bubble.appendChild(d);}
    if(els.analysisToggle.checked && result.tokens){const a=document.createElement("div");a.className="analysis-box";a.innerHTML=`<strong>Intención:</strong> ${escapeHtml(result.classification?.intent||"—")} · <strong>Motor:</strong> ${escapeHtml(result.classification?.engine||"—")} · <strong>Emoción:</strong> ${escapeHtml(result.emotion?.name||"Neutral")}<div class="token-line">${result.tokens.slice(0,24).map(t=>`<span class="token">${escapeHtml(t)}</span>`).join("")}</div>`;bubble.appendChild(a);}
    const sug=relatedSuggestions(result.topic).slice(0,3);if(sug.length){const box=document.createElement("div");box.className="suggestion-box";box.innerHTML=`<div class="suggestion-title">Temas relacionados</div><div class="chips">${sug.map(s=>`<button class="chip" data-prompt="${escapeAttr(s)}">${escapeHtml(s)}</button>`).join("")}</div>`;bubble.appendChild(box);}
    const av=document.createElement("div");av.className="avatar";av.textContent="L";w.append(av,bubble);els.chatWrap.appendChild(w);scrollBottom();
    if(save) saveMessage("ai",result.text,{model:state.model,topic:result.topic||"",steps:result.steps||[],sources:result.sources||[],tokens:result.tokens||[],emotion:result.emotion||state.emotion,classification:result.classification||{}});
  }
  function addTyping(){const w=document.createElement("div");w.className="message ai";w.id="typing";w.innerHTML=`<div class="avatar">L</div><div class="bubble"><div class="message-meta">Logic AI · procesando</div><div class="typing"><i></i><i></i><i></i></div></div>`;els.chatWrap.appendChild(w);scrollBottom();}
  function scrollBottom(){requestAnimationFrame(()=>els.chatWrap.scrollTop=els.chatWrap.scrollHeight);}

  async function sendMessage(textOverride){
    const text=String(textOverride??els.userInput.value).trim();if(!text||state.isBusy||state.model==="media")return;
    state.isBusy=true;els.sendBtn.disabled=true;renderUser(text,true);els.userInput.value="";autoGrow();updateCharCount();addTyping();
    const result=await answerText(text);$("#typing")?.remove();renderAI(result,true);if(els.ttsToggle.checked)speak(result.text);state.isBusy=false;els.sendBtn.disabled=false;els.userInput.focus();
  }

  // --------------------------- Models/UI ---------------------------
  function setModel(model){
    state.model=model;localStorage.setItem("logic-ai-model",model);$$('.model-btn').forEach(b=>b.classList.toggle('active',b.dataset.model===model));
    const meta=MODEL_META[model];els.modelTitle.textContent=meta.title;els.modelEyebrow.textContent=meta.eyebrow;els.composerHint.textContent=meta.hint;
    els.chatWrap.classList.toggle("hidden",model==="media"||model==="work");els.mediaPanel.classList.toggle("hidden",model!=="media");els.workPanel.classList.toggle("hidden",model!=="work");els.trainingPanel.classList.add("hidden");
    els.composer.classList.toggle("hidden",model==="media");els.userInput.placeholder=model==="work"?"Pídele una tarea a Work 1.0…":"Escribe un mensaje…";els.sendBtn.disabled=false;
    if(model==="work")renderStorageList(); if(model!=="media"&&model!=="work")renderActiveChat();
  }
  function updateEmotionUI(){els.emotionPill.textContent=`${state.emotion.emoji} ${state.emotion.name}`;}

  // --------------------------- TTS ---------------------------
  function loadVoices(){if("speechSynthesis" in window)state.voices=speechSynthesis.getVoices();}
  function speak(text){if(!("speechSynthesis" in window)||!text)return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="es-ES";u.rate=1;u.pitch=1;u.voice=state.voices.find(v=>v.lang?.toLowerCase()==="es-es")||state.voices.find(v=>v.lang?.toLowerCase().startsWith("es"))||null;speechSynthesis.speak(u);}

  // --------------------------- Media View ---------------------------
  function setMediaProgress(percent,label){els.mediaProgressWrap.classList.remove("hidden");els.mediaProgressBar.style.width=`${Math.max(0,Math.min(100,percent))}%`;els.mediaProgressLabel.textContent=label;}

  function fileToImage(file){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=URL.createObjectURL(file);});}
  function imageHistogram(source){
    const c=document.createElement("canvas"),ctx=c.getContext("2d",{willReadFrequently:true});c.width=96;c.height=96;ctx.drawImage(source,0,0,96,96);const data=ctx.getImageData(0,0,96,96).data;const bins=new Array(64).fill(0);
    for(let i=0;i<data.length;i+=4){if(data[i+3]<20)continue;const r=Math.min(3,Math.floor(data[i]/64)),g=Math.min(3,Math.floor(data[i+1]/64)),b=Math.min(3,Math.floor(data[i+2]/64));bins[r*16+g*4+b]++;}
    const sum=bins.reduce((a,b)=>a+b,0)||1;return bins.map(x=>x/sum);
  }
  function histSimilarity(a,b){let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return dot/(Math.sqrt(aa*bb)||1);}
  function dominantColorWords(hist){const labels=["negro","rojo","verde","amarillo","azul","violeta","cian","blanco"];const sums=new Array(8).fill(0);hist.forEach((v,i)=>{const r=Math.floor(i/16),g=Math.floor((i%16)/4),b=i%4;const bright=r+g+b;if(bright<2)sums[0]+=v;else if(bright>7)sums[7]+=v;else if(r>=g&&r>=b)sums[1]+=v;else if(g>=r&&g>=b)sums[2]+=v;else sums[4]+=v;});return sums.map((v,i)=>[labels[i],v]).sort((a,b)=>b[1]-a[1]).slice(0,2).map(x=>x[0]);}

  async function runOCR(source, label="Leyendo texto…") {
    if(!window.Tesseract) return "";
    try {
      state.tesseractBusy=true;
      const result=await Tesseract.recognize(source,"spa+eng",{logger:m=>{if(m.status==="recognizing text")setMediaProgress(15+m.progress*45,`${label} ${Math.round(m.progress*100)}%`);}});
      return (result.data?.text||"").replace(/\s+/g," ").trim();
    } catch(e){console.warn("OCR",e);return "";} finally {state.tesseractBusy=false;}
  }

  async function commonsSearchImages(query,limit=8){
    const p=new URLSearchParams({action:"query",generator:"search",gsrsearch:query,gsrnamespace:"6",gsrlimit:String(limit),prop:"imageinfo|info",iiprop:"url|extmetadata",iiurlwidth:"320",inprop:"url",format:"json",origin:"*"});
    const r=await fetch(`https://commons.wikimedia.org/w/api.php?${p}`);if(!r.ok)throw new Error(`Commons ${r.status}`);const d=await r.json();
    return Object.values(d.query?.pages||{}).map(p=>{const ii=p.imageinfo?.[0]||{};const meta=ii.extmetadata||{};return{title:(p.title||"").replace(/^File:/,""),thumb:ii.thumburl||ii.url,url:p.fullurl||ii.descriptionurl||"",description:stripHtml(meta.ImageDescription?.value||meta.ObjectName?.value||"")};}).filter(x=>x.thumb);
  }

  function loadRemoteImage(url){return new Promise((resolve,reject)=>{const img=new Image();img.crossOrigin="anonymous";img.onload=()=>resolve(img);img.onerror=reject;img.src=url;});}
  async function rankCommonsByColor(candidates,targetHist){
    const ranked=[];for(const c of candidates){try{const img=await loadRemoteImage(c.thumb);const h=imageHistogram(img);ranked.push({...c,similarity:histSimilarity(targetHist,h)});}catch{ranked.push({...c,similarity:0});}}
    return ranked.sort((a,b)=>b.similarity-a.similarity);
  }

  async function analyzeImageFile(file){
    els.mediaResult.innerHTML="";setMediaProgress(5,"Preparando imagen…");const img=await fileToImage(file);els.mediaPreview.innerHTML="";els.mediaPreview.appendChild(img.cloneNode());
    const hist=imageHistogram(img);const colors=dominantColorWords(hist);const ocr=await runOCR(img,"OCR");
    setMediaProgress(65,"Buscando candidatos en Wikimedia Commons…");const nameTerms=normalize(file.name.replace(/\.[^.]+$/," ")).split(" ").filter(x=>x.length>2);
    const q=(contentTokens(ocr).slice(0,6).join(" ")||nameTerms.slice(0,5).join(" ")||colors.join(" ")+" photograph").trim();
    let candidates=[];try{candidates=await commonsSearchImages(q,8);candidates=await rankCommonsByColor(candidates,hist);}catch(e){console.warn(e);}
    setMediaProgress(100,"Análisis terminado");renderMediaResult({ocr,colors,candidates,query:q,type:"image"});
  }

  async function videoElementFromFile(file){return new Promise((resolve,reject)=>{const v=document.createElement("video");v.preload="metadata";v.muted=true;v.playsInline=true;v.onloadedmetadata=()=>resolve(v);v.onerror=reject;v.src=URL.createObjectURL(file);});}
  function seekVideo(v,t){return new Promise((resolve,reject)=>{const done=()=>{v.removeEventListener("seeked",done);resolve();};v.addEventListener("seeked",done,{once:true});v.currentTime=Math.min(t,Math.max(0,v.duration-.001));setTimeout(()=>reject(new Error("seek timeout")),4000);});}
  function frameCanvas(v){const c=document.createElement("canvas");const scale=Math.min(1,480/(v.videoWidth||480));c.width=Math.max(1,Math.round((v.videoWidth||480)*scale));c.height=Math.max(1,Math.round((v.videoHeight||270)*scale));c.getContext("2d").drawImage(v,0,0,c.width,c.height);return c;}
  async function analyzeVideoFile(file){
    els.mediaResult.innerHTML="";setMediaProgress(2,"Leyendo video…");const v=await videoElementFromFile(file);els.mediaPreview.innerHTML="";const preview=v.cloneNode();preview.controls=true;preview.src=v.src;els.mediaPreview.appendChild(preview);
    const duration=Math.min(v.duration||0,12);const step=.1;const maxFrames=120;const count=Math.min(maxFrames,Math.max(1,Math.floor(duration/step)+1));const aggregate=new Array(64).fill(0);let ocrTexts=[];let firstCanvas=null;
    for(let i=0;i<count;i++){
      const t=Math.min(i*step,duration);try{await seekVideo(v,t);}catch{continue;}const c=frameCanvas(v);if(!firstCanvas)firstCanvas=c;const h=imageHistogram(c);h.forEach((x,j)=>aggregate[j]+=x);
      // Every frame is visually sampled at 0.1 s; OCR is done roughly every 1 s to avoid hundreds of WASM OCR passes.
      if(i%10===0 && ocrTexts.length<12){const txt=await runOCR(c,`OCR frame ${i+1}/${count}`);if(txt)ocrTexts.push(txt);}
      setMediaProgress(5+(i/count)*65,`Analizando frame ${i+1}/${count} · ${(t).toFixed(1)} s`);
    }
    const hist=aggregate.map(x=>x/(count||1));const colors=dominantColorWords(hist);const ocr=[...new Set(ocrTexts)].join(" ").slice(0,1200);const nameTerms=normalize(file.name.replace(/\.[^.]+$/," ")).split(" ").filter(x=>x.length>2);const q=(contentTokens(ocr).slice(0,6).join(" ")||nameTerms.slice(0,5).join(" ")||colors.join(" ")+" video").trim();
    let candidates=[];try{candidates=await commonsSearchImages(q,8);candidates=await rankCommonsByColor(candidates,hist);}catch(e){console.warn(e);}setMediaProgress(100,"Video analizado");renderMediaResult({ocr,colors,candidates,query:q,type:"video",frames:count,duration});
  }

  function renderMediaResult(r){
    const top=r.candidates?.[0];let explanation=top?.description?top.description.slice(0,500):"";
    els.mediaResult.innerHTML=`<div class="media-result-card"><strong>Resultado de Media View</strong><p>${r.type==="video"?`Analicé ${r.frames} muestras visuales cada 0,1 s durante hasta ${r.duration.toFixed(1)} s. `:""}${r.ocr?`Texto detectado: “${escapeHtml(r.ocr.slice(0,500))}”. `:"No detecté texto legible. "}Colores dominantes aproximados: ${r.colors.join(", ")}.</p><p><strong>Búsqueda contextual:</strong> ${escapeHtml(r.query)}</p>${top?`<p><strong>Candidato visual/contextual más cercano:</strong> ${escapeHtml(top.title)} (${Math.round(top.similarity*100)}% similitud cromática). ${escapeHtml(explanation)}</p>`:"<p>No pude obtener candidatos comparables de Wikimedia.</p>"}</div>`;
    if(r.candidates?.length){const grid=document.createElement("div");grid.className="candidate-grid";r.candidates.slice(0,6).forEach(c=>{const d=document.createElement("div");d.className="candidate";d.innerHTML=`<img src="${escapeAttr(c.thumb)}" alt=""><strong>${escapeHtml(c.title)}</strong><small>${Math.round(c.similarity*100)}% similitud de color</small><a class="source-link" href="${escapeAttr(c.url)}" target="_blank" rel="noopener noreferrer">Wikimedia ↗</a>`;grid.appendChild(d);});els.mediaResult.appendChild(grid);}
  }

  // --------------------------- Work 1.0 ---------------------------
  function openWorkDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open("logic-ai-work",1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains("files"))db.createObjectStore("files",{keyPath:"id"});};req.onsuccess=()=>{state.storageDB=req.result;resolve(req.result);};req.onerror=()=>reject(req.error);});}
  async function storeFiles(files){const db=state.storageDB||await openWorkDB();const tx=db.transaction("files","readwrite"),store=tx.objectStore("files");for(const f of files){store.put({id:`f-${Date.now()}-${Math.random().toString(36).slice(2)}`,name:f.name,type:f.type,size:f.size,createdAt:nowISO(),blob:f});}await txDone(tx);renderStorageList();}
  function txDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  async function getStoredFiles(){const db=state.storageDB||await openWorkDB();return new Promise((resolve,reject)=>{const r=db.transaction("files","readonly").objectStore("files").getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);});}
  async function deleteStoredFile(id){const db=state.storageDB||await openWorkDB();const tx=db.transaction("files","readwrite");tx.objectStore("files").delete(id);await txDone(tx);renderStorageList();}
  async function renderStorageList(){if(!els.storageList)return;try{const files=await getStoredFiles();els.storageList.innerHTML=files.length?"":"<div class='muted'>El sandbox está vacío.</div>";for(const f of files){const d=document.createElement("div");d.className="storage-item";const meta=document.createElement("div");meta.innerHTML=`<strong>${escapeHtml(f.name)}</strong><br><small>${formatBytes(f.size)} · ${escapeHtml(f.type||"archivo")}</small>`;const dl=document.createElement("button");dl.className="ghost-btn";dl.textContent="Copia";dl.onclick=()=>downloadBlob(f.blob,f.name);const del=document.createElement("button");del.className="ghost-btn";del.textContent="Eliminar";del.onclick=()=>deleteStoredFile(f.id);d.append(meta,dl,del);els.storageList.appendChild(d);}}catch(e){els.storageList.textContent="IndexedDB no disponible.";}}
  function downloadBlob(blob,name){const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);}
  function formatBytes(n){if(n<1024)return`${n} B`;if(n<1048576)return`${(n/1024).toFixed(1)} KB`;return`${(n/1048576).toFixed(1)} MB`;}

  function startTimer(seconds){stopTimer();state.timerEnd=Date.now()+seconds*1000;updateTimer();state.timerId=setInterval(updateTimer,250);}
  function updateTimer(){const rem=Math.max(0,Math.ceil((state.timerEnd-Date.now())/1000));els.clockDisplay.textContent=formatTime(rem);if(rem<=0&&state.timerId){stopTimer();els.clockDisplay.textContent="00:00";try{new Audio("data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAAAAAP8A/wD/AP8A/wD/AP8=").play();}catch{}speak("Timer terminado");}}
  function stopTimer(){if(state.timerId)clearInterval(state.timerId);state.timerId=null;}
  function formatTime(s){const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return h?`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`:`${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;}

  class ExprParser{
    constructor(s){this.s=s.replace(/\s+/g,"");this.i=0;}peek(){return this.s[this.i];}eat(c){if(this.peek()===c){this.i++;return true;}return false;}number(){let start=this.i;if(this.eat("+")){}else if(this.eat("-")){}while(/[0-9.]/.test(this.peek()||""))this.i++;const v=Number(this.s.slice(start,this.i));if(!Number.isFinite(v))throw new Error("Número inválido");return v;}factor(){if(this.eat("(")){const v=this.expr();if(!this.eat(")"))throw new Error("Falta )");return v;}let v=this.number();if(this.eat("^"))v=Math.pow(v,this.factor());return v;}term(){let v=this.factor();while(true){if(this.eat("*"))v*=this.factor();else if(this.eat("/"))v/=this.factor();else if(this.eat("%"))v%=this.factor();else break;}return v;}expr(){let v=this.term();while(true){if(this.eat("+"))v+=this.term();else if(this.eat("-"))v-=this.term();else break;}return v;}parse(){const v=this.expr();if(this.i!==this.s.length)throw new Error("Expresión no válida");if(!Number.isFinite(v))throw new Error("Resultado no finito");return v;}}
  function calculate(expr){return new ExprParser(expr).parse();}
  function naturalMathToExpr(text){return normalize(text).replace(/^.*?(calcula|resuelve|cuanto es)\s*/,"").replace(/\bmas\b/g,"+").replace(/\bmenos\b/g,"-").replace(/\bpor\b/g,"*").replace(/\bdividido (?:por|entre)\b/g,"/").replace(/\bentre\b/g,"/").replace(/\belevado a\b/g,"^").replace(/[^0-9+\-*/%^().]/g,"");}

  function parseTimerSeconds(text){const n=normalize(text);const m=n.match(/(\d+(?:[.,]\d+)?)\s*(segundo|minuto|hora)/);if(!m)return 0;const value=parseFloat(m[1].replace(",","."));return m[2].startsWith("hora")?value*3600:m[2].startsWith("minuto")?value*60:value;}
  function extractUrl(text){const m=text.match(/https?:\/\/[^\s]+/i);if(m)return m[0].replace(/[),.;]+$/,"");const n=normalize(text);const dm=n.match(/\b([a-z0-9-]+\.(?:com|org|net|io|edu|gov)(?:\/\S*)?)\b/);return dm?`https://${dm[1]}`:"";}

  async function handleWorkAgent(text,classification,emotion){
    const steps=[];const tokens=tokenizeAll(text);let reply="";let topic="Work sandbox";
    if(classification.intent==="math"){
      switchWorkApp("calculator");const expr=naturalMathToExpr(text);els.calcInput.value=expr;steps.push(`Detecté una operación matemática: ${expr||"sin expresión clara"}.`);try{const result=calculate(expr);els.calcResult.textContent=`Resultado: ${result}`;reply=`${emotionLead(emotion)}🧮 El resultado es ${result}.`;steps.push("La calculé con el parser matemático local de Work 1.0.");}catch(e){reply="No pude interpretar esa operación. Prueba, por ejemplo: calcula (15 + 3) * 4 / 2.";}
    } else if(classification.intent==="timer"){
      switchWorkApp("clock");const seconds=parseTimerSeconds(text);if(seconds>0){startTimer(seconds);reply=`⏱️ Timer iniciado por ${Math.round(seconds)} segundos.`;steps.push(`Convertí el tiempo solicitado a ${seconds} segundos y activé Task Clock.`);}else reply="Indícame un tiempo, por ejemplo: pon un timer de 5 minutos.";
    } else if(classification.intent==="browser"){
      switchWorkApp("browser");const url=extractUrl(text);if(url){els.browserUrl.value=url;openBrowser(url);reply=`🌐 Abrí ${url} en Work Browser. Si la página bloquea el iframe, usa “Leer texto” y Logic intentará obtenerla mediante CORS.`;steps.push("Detecté el enlace y lo envié al navegador del sandbox.");}else reply="Pásame una URL completa, por ejemplo https://es.wikipedia.org.";
    } else if(/\b(archivo|archivos|storage|sandbox|guardar|copia)\b/.test(normalize(text))){
      switchWorkApp("storage");const files=await getStoredFiles().catch(()=>[]);reply=files.length?`📁 Multimedia Storage tiene ${files.length} archivo(s). Puedes descargar una copia o añadir más desde el panel.`:"📁 Multimedia Storage está vacío. Puedes añadir archivos desde el panel de Work 1.0.";steps.push("Consulté el inventario local de IndexedDB.");
    } else {
      reply="🛠️ Work 1.0 está listo. Puedo activar Task Clock, calcular expresiones, abrir URLs en Work Browser o gestionar archivos de Multimedia Storage.";
    }
    return {text:reply,classification,emotion,steps,sources:[],tokens,topic};
  }

  function switchWorkApp(app){state.currentWorkApp=app;$$('.work-app').forEach(b=>b.classList.toggle('active',b.dataset.work===app));const map={storage:"#workStorage",clock:"#workClock",calculator:"#workCalculator",browser:"#workBrowser"};Object.entries(map).forEach(([k,s])=>$(s).classList.toggle("hidden",k!==app));}
  function openBrowser(url){try{const u=new URL(url);els.browserFrame.src=u.href;els.browserNotice.textContent=`Intentando mostrar ${u.hostname}. Si no aparece, el sitio probablemente bloquea iframes.`;els.browserText.classList.add("hidden");}catch{els.browserNotice.textContent="URL no válida.";}}
  async function readBrowserText(){const url=els.browserUrl.value.trim();if(!url)return;els.browserNotice.textContent="Intentando leer la página…";try{const r=await fetch(url);if(!r.ok)throw new Error(`HTTP ${r.status}`);const html=await r.text();const doc=new DOMParser().parseFromString(html,"text/html");doc.querySelectorAll("script,style,noscript,svg").forEach(x=>x.remove());const text=(doc.body?.innerText||doc.body?.textContent||"").replace(/\s+/g," ").trim().slice(0,15000);els.browserText.textContent=text||"No se encontró texto legible.";els.browserText.classList.remove("hidden");els.browserNotice.textContent="Texto obtenido mediante fetch/CORS.";}catch(e){els.browserNotice.textContent="No pude leer esa web desde el navegador: el sitio puede bloquear CORS. Puedes abrirla visualmente si permite iframe.";}}

  // --------------------------- Helpers/events ---------------------------
  function showTraining(){els.chatWrap.classList.add("hidden");els.mediaPanel.classList.add("hidden");els.workPanel.classList.add("hidden");els.trainingPanel.classList.remove("hidden");els.composer.classList.add("hidden");updateTrainingStats();}
  function closeTraining(){setModel(state.model);}
  function updateTrainingStats(){if(!els.trainingStats)return;els.trainingStats.innerHTML=`<strong>${BASE_TRAINING.length+state.customTraining.length}</strong> ejemplos · <strong>${state.customTraining.length}</strong> personalizados · motor: <strong>${state.brainReady?"Brain.js":"reglas"}</strong>`;}
  function addTraining(){const text=els.trainingText.value.trim(),intent=els.trainingIntent.value;if(!text)return;state.customTraining.push({text,intent});saveJSON("logic-ai-training",state.customTraining);els.trainingText.value="";trainBrain();}
  function resetTraining(){state.customTraining=[];saveJSON("logic-ai-training",[]);trainBrain();}
  function clearChat(){const c=ensureChat();c.messages=[];c.title="Nuevo chat";c.updatedAt=nowISO();state.lastTopic="";persistChats();renderActiveChat();}
  function autoGrow(){els.userInput.style.height="auto";els.userInput.style.height=`${Math.min(els.userInput.scrollHeight,170)}px`;}
  function updateCharCount(){els.charCount.textContent=els.userInput.value.length;}
  function loadJSON(k,f){try{const v=JSON.parse(localStorage.getItem(k));return v??f;}catch{return f;}}
  function saveJSON(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}
  function escapeHtml(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
  function escapeAttr(v){return escapeHtml(v).replace(/`/g,"&#096;");}
  function lowerFirst(s){return s?s[0].toLowerCase()+s.slice(1):s;}

  $$('.model-btn').forEach(b=>b.addEventListener('click',()=>setModel(b.dataset.model)));
  els.sendBtn.addEventListener("click",()=>sendMessage());
  els.userInput.addEventListener("input",()=>{autoGrow();updateCharCount();});
  els.userInput.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}});
  els.clearBtn.addEventListener("click",clearChat);els.newChatBtn.addEventListener("click",createNewChat);els.stopVoiceBtn.addEventListener("click",()=>speechSynthesis?.cancel?.());
  els.trainingBtn.addEventListener("click",showTraining);els.closeTraining.addEventListener("click",closeTraining);els.addTrainingBtn.addEventListener("click",addTraining);els.resetTrainingBtn.addEventListener("click",resetTraining);
  document.addEventListener("click",e=>{const c=e.target.closest("[data-prompt]");if(c){setModel(state.model==="media"||state.model==="work"?"flash":state.model);sendMessage(c.dataset.prompt);}});

  els.mediaInput.addEventListener("change",async()=>{const f=els.mediaInput.files?.[0];if(!f)return;try{if(f.type.startsWith("image/"))await analyzeImageFile(f);else if(f.type.startsWith("video/"))await analyzeVideoFile(f);else els.mediaResult.textContent="Formato no compatible.";}catch(e){console.error(e);els.mediaResult.innerHTML=`<div class="media-result-card">No pude analizar este archivo: ${escapeHtml(e.message||String(e))}</div>`;}});
  ["dragenter","dragover"].forEach(ev=>els.mediaDrop.addEventListener(ev,e=>{e.preventDefault();els.mediaDrop.style.borderColor="var(--green)";}));["dragleave","drop"].forEach(ev=>els.mediaDrop.addEventListener(ev,e=>{e.preventDefault();els.mediaDrop.style.borderColor="";}));els.mediaDrop.addEventListener("drop",async e=>{const f=e.dataTransfer.files?.[0];if(!f)return;const dt=new DataTransfer();dt.items.add(f);els.mediaInput.files=dt.files;els.mediaInput.dispatchEvent(new Event("change"));});

  $$('.work-app').forEach(b=>b.addEventListener('click',()=>switchWorkApp(b.dataset.work)));
  els.storageInput.addEventListener("change",()=>storeFiles([...els.storageInput.files]).then(()=>els.storageInput.value=""));
  els.clockStart.addEventListener("click",()=>{const v=Number(els.clockAmount.value)||0;const mult=els.clockUnit.value==="hours"?3600:els.clockUnit.value==="minutes"?60:1;if(v>0)startTimer(v*mult);});els.clockStop.addEventListener("click",()=>{stopTimer();els.clockDisplay.textContent="00:00";});
  els.calcRun.addEventListener("click",()=>{try{els.calcResult.textContent=`Resultado: ${calculate(els.calcInput.value)}`;}catch(e){els.calcResult.textContent=`Error: ${e.message}`;}});els.calcInput.addEventListener("keydown",e=>{if(e.key==="Enter")els.calcRun.click();});
  els.browserGo.addEventListener("click",()=>openBrowser(els.browserUrl.value.trim()));els.browserRead.addEventListener("click",readBrowserText);els.browserUrl.addEventListener("keydown",e=>{if(e.key==="Enter")els.browserGo.click();});

  loadVoices();if("speechSynthesis" in window)speechSynthesis.onvoiceschanged=loadVoices;
  openWorkDB().catch(()=>{});
  ensureChat();renderHistory();setModel(state.model);updateEmotionUI();
  window.addEventListener("load",()=>{trainBrain();renderActiveChat();els.userInput.focus();});
})();
