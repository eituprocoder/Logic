(() => {
  "use strict";

  // ------------------------------------------------------------
  // Logic AI Nivel 1.5
  // No usa modelos preentrenados ni APIs de IA.
  // Brain.js = clasificador entrenado EN EL NAVEGADOR.
  // Wikipedia = fuente externa de conocimiento.
  // SpeechSynthesis = TextToSpeech clásico del navegador.
  // ------------------------------------------------------------

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const state = {
    mode: "logic",
    network: null,
    brainReady: false,
    isBusy: false,
    lastTopic: "",
    customTraining: loadJSON("logic-ai-training", []),
    chats: loadJSON("logic-ai-chats", []),
    activeChatId: localStorage.getItem("logic-ai-active-chat") || "",
    voices: []
  };

  const BASE_TRAINING = [
    ["hola", "greeting"], ["buenas", "greeting"], ["buen dia", "greeting"],
    ["buenas tardes", "greeting"], ["hey", "greeting"], ["holi", "greeting"],
    ["hola logic", "greeting"], ["saludos", "greeting"],

    ["como estas", "wellbeing"], ["como te va", "wellbeing"],
    ["todo bien", "wellbeing"], ["que tal estas", "wellbeing"],
    ["como andas", "wellbeing"],

    ["que es marte", "definition"], ["que es una estrella", "definition"],
    ["que significa fotosintesis", "definition"], ["define gravedad", "definition"],
    ["que es un agujero negro", "definition"],

    ["por que marte es rojo", "explanation"], ["explicame la fotosintesis", "explanation"],
    ["como funciona internet", "explanation"], ["por que llueve", "explanation"],
    ["como se forma un volcan", "explanation"],

    ["quien es albert einstein", "person"], ["quien fue mozart", "person"],
    ["quien era marie curie", "person"], ["biografia de nikola tesla", "person"],

    ["cuando nacio einstein", "time"], ["en que año fue la revolucion francesa", "time"],
    ["cuando ocurrio", "time"], ["en que fecha paso", "time"],

    ["gracias", "conversation"], ["genial", "conversation"], ["entiendo", "conversation"],
    ["que haces", "conversation"], ["quien eres", "conversation"],
    ["puedes hablar conmigo", "conversation"],

    ["busca marte", "search"], ["investiga sobre saturno", "search"],
    ["busca en wikipedia", "search"], ["quiero informacion de venus", "search"],
    ["dame informacion sobre japon", "search"]
  ];

  const VOCABULARY = [
    "hola","buenas","buen","dia","tardes","hey","saludos",
    "como","estas","te","va","anda","andas","tal","todo","bien",
    "que","es","significa","define","definicion",
    "por","porque","explica","explicame","funciona","funcionar","forma",
    "quien","fue","era","biografia","persona",
    "cuando","fecha","ano","ocurrio","paso","nacio",
    "busca","buscar","investiga","investigar","informacion","wikipedia","sobre",
    "gracias","genial","entiendo","haces","eres","hablar","conmigo"
  ];

  const INTENTS = [
    "greeting", "wellbeing", "definition", "explanation",
    "person", "time", "conversation", "search"
  ];

  const intentLabels = {
    greeting: "saludo",
    wellbeing: "conversación / estado",
    definition: "definición",
    explanation: "explicación",
    person: "persona",
    time: "fecha / tiempo",
    conversation: "conversación",
    search: "búsqueda"
  };

  const els = {
    chatWrap: $("#chatWrap"),
    trainingPanel: $("#trainingPanel"),
    userInput: $("#userInput"),
    sendBtn: $("#sendBtn"),
    clearBtn: $("#clearBtn"),
    newChatBtn: $("#newChatBtn"),
    chatHistory: $("#chatHistory"),
    stopVoiceBtn: $("#stopVoiceBtn"),
    ttsToggle: $("#ttsToggle"),
    analysisToggle: $("#analysisToggle"),
    brainDot: $("#brainDot"),
    brainStatus: $("#brainStatus"),
    modeTitle: $("#modeTitle"),
    composerHint: $("#composerHint"),
    charCount: $("#charCount"),
    trainingText: $("#trainingText"),
    trainingIntent: $("#trainingIntent"),
    addTrainingBtn: $("#addTrainingBtn"),
    resetTrainingBtn: $("#resetTrainingBtn"),
    trainingStats: $("#trainingStats")
  };

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[¿?¡!]/g, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenize(text) {
    return normalize(text).split(" ").filter(Boolean);
  }

  function vectorize(text) {
    const words = new Set(tokenize(text));
    const vector = {};
    VOCABULARY.forEach(word => {
      vector[word] = words.has(word) ? 1 : 0;
    });

    // Features extra para no depender solamente del vocabulario literal.
    const n = normalize(text);
    vector.__hasQuestion = /[?¿]/.test(text) ? 1 : 0;
    vector.__startsQue = n.startsWith("que ") ? 1 : 0;
    vector.__startsQuien = n.startsWith("quien ") ? 1 : 0;
    vector.__startsCuando = n.startsWith("cuando ") ? 1 : 0;
    vector.__startsComo = n.startsWith("como ") ? 1 : 0;
    vector.__startsPorQue = n.startsWith("por que ") ? 1 : 0;
    vector.__searchVerb = /\b(busca|buscar|investiga|investigar)\b/.test(n) ? 1 : 0;
    return vector;
  }

  function oneHot(intent) {
    const out = {};
    INTENTS.forEach(name => out[name] = name === intent ? 1 : 0);
    return out;
  }

  function trainBrain() {
    const all = [...BASE_TRAINING, ...state.customTraining.map(x => [x.text, x.intent])];

    if (!window.brain || !window.brain.NeuralNetwork) {
      state.network = null;
      state.brainReady = false;
      els.brainDot.className = "dot error";
      els.brainStatus.textContent = "Brain.js no cargó · usando reglas";
      updateTrainingStats();
      return;
    }

    try {
      const net = new brain.NeuralNetwork({
        hiddenLayers: [18, 12],
        activation: "sigmoid"
      });

      const trainingData = all.map(([text, intent]) => ({
        input: vectorize(text),
        output: oneHot(intent)
      }));

      net.train(trainingData, {
        iterations: 1800,
        errorThresh: 0.007,
        log: false,
        learningRate: 0.25
      });

      state.network = net;
      state.brainReady = true;
      els.brainDot.className = "dot ready";
      els.brainStatus.textContent = "Brain.js entrenado localmente";
    } catch (error) {
      console.warn("Brain.js training failed:", error);
      state.network = null;
      state.brainReady = false;
      els.brainDot.className = "dot error";
      els.brainStatus.textContent = "Clasificador de respaldo activo";
    }

    updateTrainingStats();
  }

  function heuristicIntent(text) {
    const n = normalize(text);

    if (/^(hola|buenas|buen dia|buenas tardes|hey|holi|saludos)\b/.test(n)) return "greeting";
    if (/\b(como estas|como te va|que tal estas|como andas)\b/.test(n)) return "wellbeing";
    if (/^(por que|explica|explicame|como funciona|como se forma)\b/.test(n)) return "explanation";
    if (/^(quien es|quien fue|quien era|biografia de)\b/.test(n)) return "person";
    if (/^(cuando|en que ano|en que fecha)\b/.test(n)) return "time";
    if (/^(que es|que significa|define)\b/.test(n)) return "definition";
    if (/\b(busca|investiga|wikipedia|informacion sobre|informacion de)\b/.test(n)) return "search";
    if (/\b(gracias|genial|entiendo|quien eres|que haces)\b/.test(n)) return "conversation";
    return text.includes("?") ? "search" : "conversation";
  }

  function classifyIntent(text) {
    const heuristic = heuristicIntent(text);

    if (!state.brainReady || !state.network) {
      return { intent: heuristic, confidence: 0.55, engine: "reglas" };
    }

    try {
      const output = state.network.run(vectorize(text));
      const ranked = Object.entries(output).sort((a, b) => b[1] - a[1]);
      const [intent, confidence] = ranked[0];

      // Si la red está poco segura, las reglas lingüísticas mandan.
      if (!intent || confidence < 0.42) {
        return { intent: heuristic, confidence, engine: "Brain.js + respaldo" };
      }

      // Para patrones muy claros, evitamos un falso positivo de la red.
      const obvious = heuristicIntent(text);
      const n = normalize(text);
      const hasStrongPattern =
        /^(que es|que significa|define|por que|quien es|quien fue|cuando|busca|investiga|hola|buenas)\b/.test(n) ||
        /\b(como estas|que tal estas)\b/.test(n);

      return {
        intent: hasStrongPattern ? obvious : intent,
        confidence,
        engine: hasStrongPattern ? "Brain.js + reglas" : "Brain.js"
      };
    } catch {
      return { intent: heuristic, confidence: 0.5, engine: "reglas" };
    }
  }

  function smartSegments(text) {
    const raw = String(text || "").trim();
    if (!raw) return [];

    // Divide principalmente por puntuación fuerte y comas,
    // pero mantiene expresiones útiles como "qué es..." juntas.
    const firstPass = raw
      .split(/(?<=[.!?])\s+|,\s+/g)
      .map(x => x.trim())
      .filter(Boolean);

    // Caso: "Hola ¿cómo estás?" sin coma.
    const output = [];
    for (const part of firstPass) {
      const n = normalize(part);
      const greetingMatch = n.match(/^(hola|buenas|hey|holi|buen dia|buenas tardes)\s+(.+)$/);
      if (greetingMatch && /\b(como|que|quien|cuando|por que)\b/.test(greetingMatch[2])) {
        const greeting = part.slice(0, greetingMatch[1].length);
        const rest = part.slice(greetingMatch[1].length).trim();
        output.push(greeting, rest);
      } else {
        output.push(part);
      }
    }

    return output.slice(0, 8);
  }

  function extractTopic(text, intent) {
    let n = normalize(text);

    const patterns = {
      definition: [/^que es\s+/, /^que significa\s+/, /^define\s+/],
      explanation: [/^por que\s+/, /^explica(?:me)?\s+/, /^como funciona\s+/, /^como se forma\s+/],
      person: [/^quien es\s+/, /^quien fue\s+/, /^quien era\s+/, /^biografia de\s+/],
      time: [/^cuando\s+/, /^en que ano\s+/, /^en que fecha\s+/],
      search: [/^busca(?:r)?\s+/, /^investiga(?:r)?\s+/, /^informacion (?:sobre|de)\s+/, /^dame informacion (?:sobre|de)\s+/]
    };

    for (const re of patterns[intent] || []) n = n.replace(re, "");

    n = n.replace(/\b(en wikipedia|por favor|porfa|please)\b/g, " ").replace(/\s+/g, " ").trim();

    // Evita consultas vacías.
    return n || normalize(text);
  }

  function localReply(segment, intent) {
    const n = normalize(segment);

    if (intent === "greeting") {
      const options = [
        "¡Hola! 👋 ¿Cómo estás? ¿En qué te ayudo?",
        "¡Hola! Soy Logic AI 😎. ¿Qué quieres explorar?",
        "¡Buenas! 👋 Estoy listo. Puedes preguntarme algo o pedirme que lo investigue."
      ];
      return options[Math.floor(Math.random() * options.length)];
    }

    if (intent === "wellbeing") {
      return "¡Muy bien! 😄 Estoy funcionando en tu navegador y listo para conversar. ¿Cómo estás tú?";
    }

    if (intent === "conversation") {
      if (/\b(gracias|muchas gracias)\b/.test(n)) return "¡De nada! 😄";
      if (/\b(quien eres|que eres)\b/.test(n)) {
        return "Soy Logic AI Nivel 1: uso un clasificador Brain.js entrenado localmente, reglas de conversación y Wikipedia cuando necesito conocimiento externo.";
      }
      if (/\b(que haces|que puedes hacer)\b/.test(n)) {
        return "Puedo conversar, detectar la intención de tu mensaje, dividir frases compuestas, buscar información en Wikipedia y leer mis respuestas con TextToSpeech.";
      }
      if (/\b(genial|perfecto|excelente)\b/.test(n)) return "😎 ¡Perfecto! Sigamos.";
      if (/\b(entiendo|entendido)\b/.test(n)) return "Exacto. Si quieres, prueba ahora con una pregunta de conocimiento.";
      return "Te escucho. Puedes seguir hablando conmigo o hacerme una pregunta concreta para que use mi motor de conocimiento.";
    }

    return null;
  }

  async function wikipediaSearch(query, limit = 5) {
    const endpoint = "https://es.wikipedia.org/w/api.php";
    const params = new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: query,
      srlimit: String(limit),
      srprop: "snippet|wordcount",
      format: "json",
      origin: "*"
    });

    const response = await fetch(`${endpoint}?${params.toString()}`);
    if (!response.ok) throw new Error(`Wikipedia search HTTP ${response.status}`);

    const data = await response.json();
    return (data.query?.search || []).map(item => ({
      title: item.title,
      pageid: item.pageid,
      snippet: stripHtml(item.snippet || ""),
      wordcount: item.wordcount || 0
    }));
  }

  async function wikipediaExtracts(titles) {
    if (!titles.length) return [];

    const endpoint = "https://es.wikipedia.org/w/api.php";
    const params = new URLSearchParams({
      action: "query",
      prop: "extracts|info",
      exintro: "1",
      explaintext: "1",
      exsentences: "7",
      inprop: "url",
      redirects: "1",
      titles: titles.join("|"),
      format: "json",
      origin: "*"
    });

    const response = await fetch(`${endpoint}?${params.toString()}`);
    if (!response.ok) throw new Error(`Wikipedia extract HTTP ${response.status}`);

    const data = await response.json();
    const pages = Object.values(data.query?.pages || {});

    return pages
      .filter(page => !page.missing)
      .map(page => ({
        title: page.title,
        extract: (page.extract || "").trim(),
        url: page.fullurl || `https://es.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`
      }));
  }

  function stripHtml(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  }

  function splitSentences(text) {
    return String(text || "")
      .split(/(?<=[.!?])\s+/)
      .map(x => x.trim())
      .filter(x => x.length > 15);
  }

  function importantTerms(text) {
    const stop = new Set([
      "que","es","una","un","el","la","los","las","de","del","y","o","a","en",
      "por","para","como","se","su","sus","me","te","lo","le","con","sin","al",
      "porque","quien","cuando","donde","cual","sobre","explica","explicame",
      "busca","investiga","informacion","quiero","dame"
    ]);

    return [...new Set(tokenize(text).filter(w => w.length > 2 && !stop.has(w)))];
  }

  function scoreSentence(sentence, originalQuestion, topic, index) {
    const s = normalize(sentence);
    const qTerms = importantTerms(originalQuestion);
    const tTerms = importantTerms(topic);

    let score = 0;
    for (const term of qTerms) if (s.includes(term)) score += 3;
    for (const term of tTerms) if (s.includes(term)) score += 4;

    // Bonificación para frases explicativas frecuentes.
    if (/\b(debido|porque|causa|produce|consiste|se debe|permite|provoca|mediante)\b/.test(s)) score += 3;
    if (index === 0) score += 2;
    if (sentence.length >= 70 && sentence.length <= 300) score += 1.5;

    return score;
  }

  function chooseBestSentences(extract, originalQuestion, topic, max = 2) {
    const sentences = splitSentences(extract);
    if (!sentences.length) return extract;

    const ranked = sentences
      .map((sentence, index) => ({
        sentence,
        index,
        score: scoreSentence(sentence, originalQuestion, topic, index)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, max)
      .sort((a, b) => a.index - b.index);

    return ranked.map(x => x.sentence).join(" ");
  }

  function conversationalPrefix(intent, topic) {
    switch (intent) {
      case "definition": return `${capitalize(topic)}: `;
      case "explanation": return "La idea principal es esta: ";
      case "person": return "";
      case "time": return "";
      default: return "";
    }
  }

  async function answerKnowledge(segment, classification) {
    let topic = extractTopic(segment, classification.intent);
    const rememberedTopic = inferTopicFromMemory(segment);
    const vague = /^(y\b|y su\b|y sus\b|y eso\b|y tambien\b|que mas\b|hablame mas\b|continua\b|sigue\b)/.test(normalize(segment));
    if (rememberedTopic && (vague || importantTerms(topic).length < 2)) topic = rememberedTopic;
    state.lastTopic = topic;

    const searchResults = await wikipediaSearch(topic, state.mode === "research" ? 6 : 4);

    if (!searchResults.length) {
      return {
        text: `No encontré un artículo claro en Wikipedia para “${topic}”. Prueba formulándolo de otra manera.`,
        topic,
        sources: []
      };
    }

    const titles = searchResults.slice(0, state.mode === "research" ? 5 : 3).map(x => x.title);
    const pages = await wikipediaExtracts(titles);

    if (!pages.length) {
      return {
        text: `Encontré coincidencias para “${topic}”, pero no pude obtener un resumen utilizable.`,
        topic,
        sources: []
      };
    }

    if (state.mode === "research") {
      return {
        text: `Encontré ${pages.length} resultados relacionados con “${topic}”.`,
        topic,
        sources: pages.map(page => ({
          title: page.title,
          text: chooseBestSentences(page.extract, segment, topic, 2),
          url: page.url
        }))
      };
    }

    // Logic Mode: seleccionar el artículo con mejor coincidencia.
    const topicNorm = normalize(topic);
    let bestPage = pages[0];
    let bestScore = -1;

    for (const page of pages) {
      const titleNorm = normalize(page.title);
      let score = 0;

      for (const term of importantTerms(topicNorm)) {
        if (titleNorm.includes(term)) score += 5;
        if (normalize(page.extract).includes(term)) score += 1;
      }

      if (titleNorm === topicNorm) score += 20;

      if (score > bestScore) {
        bestScore = score;
        bestPage = page;
      }
    }

    const selected = chooseBestSentences(bestPage.extract, segment, topic, classification.intent === "explanation" ? 3 : 2);
    const prefix = conversationalPrefix(classification.intent, bestPage.title);

    return {
      text: `${prefix}${selected}`,
      topic,
      sources: [{
        title: bestPage.title,
        text: selected,
        url: bestPage.url
      }]
    };
  }


  // ---------------- Memory, history, suggestions and emojis ----------------
  function nowISO() {
    return new Date().toISOString();
  }

  function ensureChat() {
    let chat = state.chats.find(c => c.id === state.activeChatId);
    if (!chat) {
      chat = {
        id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: "Nuevo chat",
        createdAt: nowISO(),
        updatedAt: nowISO(),
        messages: []
      };
      state.chats.unshift(chat);
      state.activeChatId = chat.id;
      persistChats();
    }
    return chat;
  }

  function persistChats() {
    // Conserva como máximo 30 chats y 100 mensajes por chat.
    state.chats = state.chats
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(0, 30)
      .map(chat => ({ ...chat, messages: (chat.messages || []).slice(-100) }));
    saveJSON("logic-ai-chats", state.chats);
    localStorage.setItem("logic-ai-active-chat", state.activeChatId || "");
    renderHistory();
  }

  function createNewChat() {
    speechSynthesis?.cancel?.();
    const chat = {
      id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: "Nuevo chat",
      createdAt: nowISO(),
      updatedAt: nowISO(),
      messages: []
    };
    state.chats.unshift(chat);
    state.activeChatId = chat.id;
    state.lastTopic = "";
    persistChats();
    renderActiveChat();
  }

  function saveMessage(role, text, extra = {}) {
    const chat = ensureChat();
    chat.messages.push({ role, text, createdAt: nowISO(), ...extra });
    chat.updatedAt = nowISO();
    if (chat.title === "Nuevo chat" && role === "user") {
      chat.title = text.replace(/\s+/g, " ").trim().slice(0, 38) || "Nuevo chat";
    }
    persistChats();
  }

  function renderHistory() {
    if (!els.chatHistory) return;
    els.chatHistory.innerHTML = "";
    state.chats.slice(0, 12).forEach(chat => {
      const btn = document.createElement("button");
      btn.className = `history-item${chat.id === state.activeChatId ? " active" : ""}`;
      btn.textContent = chat.title || "Chat";
      btn.title = chat.title || "Chat";
      btn.addEventListener("click", () => {
        state.activeChatId = chat.id;
        localStorage.setItem("logic-ai-active-chat", chat.id);
        renderHistory();
        renderActiveChat();
      });
      els.chatHistory.appendChild(btn);
    });
  }

  function renderActiveChat() {
    const chat = ensureChat();
    const lastTopicMessage = [...(chat.messages || [])].reverse().find(msg => msg.topic);
    state.lastTopic = lastTopicMessage?.topic || "";
    els.chatWrap.innerHTML = "";

    if (!chat.messages.length) {
      els.chatWrap.innerHTML = `
        <div class="message ai">
          <div class="avatar">L</div>
          <div class="bubble">
            <div class="message-meta">Logic AI</div>
            <p>¡Hola! 👋 Este es un nuevo chat. Recordaré conversaciones anteriores para conectar temas cuando sea útil.</p>
          </div>
        </div>`;
      return;
    }

    for (const msg of chat.messages) {
      if (msg.role === "user") addUserMessage(msg.text, false);
      else addStoredAIMessage(msg);
    }
    scrollBottom();
  }

  function addStoredAIMessage(msg) {
    const wrapper = document.createElement("div");
    wrapper.className = "message ai";
    const suggestions = (msg.suggestions || []).map(s => `<button class="chip" data-prompt="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("");
    wrapper.innerHTML = `
      <div class="avatar">L</div>
      <div class="bubble">
        <div class="message-meta">Logic AI</div>
        <p>${escapeHtml(msg.text)}</p>
        ${suggestions ? `<div class="suggestion-box"><div class="suggestion-title">Temas relacionados</div><div class="chips">${suggestions}</div></div>` : ""}
      </div>`;
    els.chatWrap.appendChild(wrapper);
  }

  function memoryCandidates(query) {
    const terms = importantTerms(query);
    const candidates = [];

    for (const chat of state.chats) {
      for (const msg of chat.messages || []) {
        const hay = normalize(`${msg.text || ""} ${msg.topic || ""}`);
        let score = 0;
        for (const term of terms) if (hay.includes(term)) score += 2;
        if (msg.topic && terms.some(t => normalize(msg.topic).includes(t))) score += 3;
        if (score > 0) candidates.push({ chatId: chat.id, msg, score });
      }
    }
    return candidates.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  function inferTopicFromMemory(text) {
    const n = normalize(text);
    const vagueFollowup = /^(y\b|y su\b|y sus\b|y eso\b|y tambien\b|que mas\b|hablame mas\b|continua\b|sigue\b)/.test(n)
      || /\b(eso|ese tema|lo anterior|antes)\b/.test(n);

    if (vagueFollowup && state.lastTopic) return state.lastTopic;

    const memories = memoryCandidates(text);
    const withTopic = memories.find(x => x.msg.topic);
    return withTopic?.msg.topic || "";
  }

  function topicEmoji(text) {
    const n = normalize(text);
    const rules = [
      [/\b(marte|saturno|jupiter|planeta|estrella|espacio|universo|galaxia|luna|sol|astronom)\b/, "🪐"],
      [/\b(program|codigo|javascript|html|css|software|computadora|ia|inteligencia artificial|brain)\b/, "💻"],
      [/\b(perro|gato|animal|mascota|caballo|ave)\b/, "🐾"],
      [/\b(musica|cancion|mozart|piano|guitarra)\b/, "🎵"],
      [/\b(historia|guerra|revolucion|imperio|rey|reina)\b/, "📜"],
      [/\b(ciencia|fisica|quimica|biologia|experimento)\b/, "🔬"],
      [/\b(futbol|tenis|deporte|partido|jugador)\b/, "⚽"],
      [/\b(comida|receta|cocina|pastel|chocolate)\b/, "🍽️"],
      [/\b(viaje|pais|ciudad|turismo|hotel)\b/, "✈️"],
      [/\b(hola|gracias|genial|perfecto|feliz)\b/, "😊"]
    ];
    return rules.find(([re]) => re.test(n))?.[1] || "";
  }

  function decorateWithEmoji(text, context) {
    const emoji = topicEmoji(`${context || ""} ${text}`);
    if (!emoji || /[\u{1F300}-\u{1FAFF}]/u.test(text)) return text;
    return `${text} ${emoji}`;
  }

  function relatedSuggestions(topic, text) {
    const base = normalize(`${topic || ""} ${text || ""}`);
    const suggestions = [];
    const add = value => { if (value && !suggestions.includes(value)) suggestions.push(value); };

    if (/\b(marte|planeta|espacio|universo|estrella|saturno|jupiter)\b/.test(base)) {
      add("¿Cómo es su atmósfera?"); add("¿Qué curiosidades tiene?"); add("¿Cómo se compara con la Tierra?");
    } else if (/\b(program|javascript|html|css|software|ia|brain)\b/.test(base)) {
      add("¿Cómo funciona por dentro?"); add("¿Qué podría mejorar después?"); add("Dame un ejemplo práctico");
    } else if (/\b(persona|einstein|mozart|tesla|curie|biografia)\b/.test(base)) {
      add("¿Cuáles fueron sus aportes principales?"); add("¿Qué pasó después en su vida?");
    } else if (topic) {
      add(`Cuéntame una curiosidad sobre ${topic}`);
      add(`Explícame más sobre ${topic}`);
    }

    // Recupera un tema relacionado de otros chats.
    const memory = memoryCandidates(topic || text).find(x => x.msg.topic && normalize(x.msg.topic) !== normalize(topic || ""));
    if (memory?.msg?.topic) add(`¿Qué relación tiene con ${memory.msg.topic}?`);

    // “A veces”: no muestra sugerencias en todos los turnos.
    const checksum = [...String(text || topic || "")].reduce((a, c) => a + c.charCodeAt(0), 0);
    return checksum % 3 === 0 ? [] : suggestions.slice(0, 3);
  }

  async function processMessage(text) {
    const segments = smartSegments(text);
    const results = [];

    for (const segment of segments) {
      const classification = classifyIntent(segment);
      const local = localReply(segment, classification.intent);

      if (local) {
        const contextual = decorateWithEmoji(local, segment);
        results.push({
          segment,
          classification,
          text: contextual,
          sources: [],
          suggestions: relatedSuggestions(state.lastTopic, segment)
        });
        continue;
      }

      try {
        const knowledge = await answerKnowledge(segment, classification);
        knowledge.text = decorateWithEmoji(knowledge.text, `${segment} ${knowledge.topic || ""}`);
        knowledge.suggestions = relatedSuggestions(knowledge.topic, segment);
        results.push({
          segment,
          classification,
          ...knowledge
        });
      } catch (error) {
        console.error(error);
        results.push({
          segment,
          classification,
          text: "No pude conectarme con Wikipedia en este momento. Mi parte local sigue funcionando, pero para responder esa pregunta necesito acceso a Wikipedia.",
          sources: [],
          error: true
        });
      }
    }

    return results;
  }

  function buildCombinedReply(results) {
    if (state.mode === "research") {
      return results.map(r => r.text).join(" ");
    }

    return results.map(r => r.text).join(" ");
  }

  function addUserMessage(text, persist = true) {
    const wrapper = document.createElement("div");
    wrapper.className = "message user";
    wrapper.innerHTML = `
      <div class="bubble">
        <div class="message-meta">Tú</div>
        <p>${escapeHtml(text)}</p>
      </div>
      <div class="avatar">T</div>
    `;
    els.chatWrap.appendChild(wrapper);
    if (persist) saveMessage("user", text);
    scrollBottom();
  }

  function addTyping() {
    const wrapper = document.createElement("div");
    wrapper.className = "message ai";
    wrapper.id = "typingMessage";
    wrapper.innerHTML = `
      <div class="avatar">L</div>
      <div class="bubble">
        <div class="message-meta">Logic AI · analizando</div>
        <div class="typing"><i></i><i></i><i></i></div>
      </div>
    `;
    els.chatWrap.appendChild(wrapper);
    scrollBottom();
  }

  function removeTyping() {
    $("#typingMessage")?.remove();
  }

  function addAIMessage(results) {
    const wrapper = document.createElement("div");
    wrapper.className = "message ai";

    const body = document.createElement("div");
    body.className = "bubble";

    const meta = document.createElement("div");
    meta.className = "message-meta";
    meta.textContent = state.mode === "research" ? "Logic AI · Research" : "Logic AI";
    body.appendChild(meta);

    for (const [index, result] of results.entries()) {
      const p = document.createElement("p");
      p.textContent = result.text;
      body.appendChild(p);

      if (state.mode === "research" && result.sources?.length) {
        const list = document.createElement("ul");
        list.className = "result-list";

        result.sources.forEach(source => {
          const li = document.createElement("li");
          li.className = "result-card";

          const title = document.createElement("div");
          title.className = "result-title";
          title.textContent = source.title;

          const txt = document.createElement("p");
          txt.textContent = source.text || "Sin extracto disponible.";

          const link = document.createElement("a");
          link.className = "source-link";
          link.href = source.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = "Abrir en Wikipedia ↗";

          li.append(title, txt, link);
          list.appendChild(li);
        });

        body.appendChild(list);
      } else if (result.sources?.[0]?.url) {
        const link = document.createElement("a");
        link.className = "source-link";
        link.href = result.sources[0].url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = `Fuente: Wikipedia · ${result.sources[0].title} ↗`;
        body.appendChild(link);
      }

      if (els.analysisToggle.checked) {
        const a = document.createElement("div");
        a.className = "analysis-box";
        a.innerHTML = [
          `<strong>Segmento:</strong> <code>${escapeHtml(result.segment)}</code>`,
          `<strong>Intención:</strong> ${escapeHtml(intentLabels[result.classification.intent] || result.classification.intent)}`,
          `<strong>Confianza:</strong> ${Math.round((result.classification.confidence || 0) * 100)}%`,
          `<strong>Motor:</strong> ${escapeHtml(result.classification.engine)}`,
          result.topic ? `<strong>Tema:</strong> ${escapeHtml(result.topic)}` : ""
        ].filter(Boolean).join(" · ");
        body.appendChild(a);
      }

      if (result.suggestions?.length) {
        const suggestionBox = document.createElement("div");
        suggestionBox.className = "suggestion-box";
        suggestionBox.innerHTML = `<div class="suggestion-title">💡 Temas relacionados</div>`;
        const chips = document.createElement("div");
        chips.className = "chips";
        result.suggestions.forEach(text => {
          const btn = document.createElement("button");
          btn.className = "chip";
          btn.dataset.prompt = text;
          btn.textContent = text;
          chips.appendChild(btn);
        });
        suggestionBox.appendChild(chips);
        body.appendChild(suggestionBox);
      }

      if (index < results.length - 1) {
        const spacer = document.createElement("div");
        spacer.style.height = "8px";
        body.appendChild(spacer);
      }
    }

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = "L";

    wrapper.append(avatar, body);
    els.chatWrap.appendChild(wrapper);
    scrollBottom();
  }

  async function sendMessage(textOverride) {
    const text = String(textOverride ?? els.userInput.value).trim();
    if (!text || state.isBusy || state.mode === "training") return;

    state.isBusy = true;
    els.sendBtn.disabled = true;

    addUserMessage(text);
    els.userInput.value = "";
    autoGrow();
    updateCharCount();
    addTyping();

    const results = await processMessage(text);

    removeTyping();
    addAIMessage(results);
    saveMessage("ai", buildCombinedReply(results), {
      topic: results.map(r => r.topic).filter(Boolean).at(-1) || state.lastTopic || "",
      suggestions: [...new Set(results.flatMap(r => r.suggestions || []))].slice(0, 3)
    });

    const spoken = buildCombinedReply(results);
    if (els.ttsToggle.checked) speak(spoken);

    state.isBusy = false;
    els.sendBtn.disabled = false;
    els.userInput.focus();
  }

  function speak(text) {
    if (!("speechSynthesis" in window) || !text) return;

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(
      text.replace(/https?:\/\/\S+/g, "")
    );
    utterance.lang = "es-ES";
    utterance.rate = 1;
    utterance.pitch = 1;

    const spanish =
      state.voices.find(v => v.lang?.toLowerCase() === "es-es") ||
      state.voices.find(v => v.lang?.toLowerCase().startsWith("es"));

    if (spanish) utterance.voice = spanish;
    speechSynthesis.speak(utterance);
  }

  function loadVoices() {
    if (!("speechSynthesis" in window)) return;
    state.voices = speechSynthesis.getVoices();
  }

  function setMode(mode) {
    state.mode = mode;

    $$(".mode-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });

    const training = mode === "training";
    els.chatWrap.classList.toggle("hidden", training);
    els.trainingPanel.classList.toggle("hidden", !training);

    const titles = {
      logic: "Logic Mode",
      research: "Research Mode",
      training: "Training Center"
    };
    els.modeTitle.textContent = titles[mode];

    const hints = {
      logic: "Brain.js decide la intención; Wikipedia se usa solo cuando hace falta.",
      research: "Busca varios artículos y muestra información comparada.",
      training: "Los ejemplos se guardan localmente en este navegador."
    };
    els.composerHint.textContent = hints[mode];

    els.userInput.disabled = training;
    els.sendBtn.disabled = training;

    if (training) updateTrainingStats();
    else els.userInput.focus();
  }

  function updateTrainingStats() {
    const total = BASE_TRAINING.length + state.customTraining.length;
    els.trainingStats.innerHTML = `
      <strong>${total}</strong> ejemplos totales ·
      <strong>${state.customTraining.length}</strong> creados por ti ·
      motor actual: <strong>${state.brainReady ? "Brain.js" : "reglas de respaldo"}</strong>.
    `;
  }

  function addTrainingExample() {
    const text = els.trainingText.value.trim();
    const intent = els.trainingIntent.value;
    if (!text) return;

    state.customTraining.push({ text, intent });
    saveJSON("logic-ai-training", state.customTraining);
    els.trainingText.value = "";

    trainBrain();
  }

  function resetTrainingExamples() {
    state.customTraining = [];
    saveJSON("logic-ai-training", state.customTraining);
    trainBrain();
  }

  function clearChat() {
    speechSynthesis?.cancel?.();
    const chat = ensureChat();
    chat.messages = [];
    chat.title = "Nuevo chat";
    chat.updatedAt = nowISO();
    state.lastTopic = "";
    persistChats();
    renderActiveChat();
  }

  function autoGrow() {
    els.userInput.style.height = "auto";
    els.userInput.style.height = `${Math.min(els.userInput.scrollHeight, 180)}px`;
  }

  function updateCharCount() {
    els.charCount.textContent = els.userInput.value.length;
  }

  function scrollBottom() {
    requestAnimationFrame(() => {
      els.chatWrap.scrollTop = els.chatWrap.scrollHeight;
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function capitalize(value) {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  }

  function loadJSON(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  // Events
  els.sendBtn.addEventListener("click", () => sendMessage());

  els.userInput.addEventListener("input", () => {
    autoGrow();
    updateCharCount();
  });

  els.userInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  els.clearBtn.addEventListener("click", clearChat);
  els.newChatBtn?.addEventListener("click", createNewChat);
  els.stopVoiceBtn.addEventListener("click", () => speechSynthesis?.cancel?.());
  els.addTrainingBtn.addEventListener("click", addTrainingExample);
  els.resetTrainingBtn.addEventListener("click", resetTrainingExamples);

  $$(".mode-btn").forEach(btn => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  document.addEventListener("click", event => {
    const chip = event.target.closest("[data-prompt]");
    if (!chip) return;
    sendMessage(chip.dataset.prompt);
  });

  // Init
  ensureChat();
  renderHistory();
  renderActiveChat();
  loadVoices();
  if ("speechSynthesis" in window) {
    speechSynthesis.onvoiceschanged = loadVoices;
  }

  // Dejamos que el CDN termine de registrar `brain` antes de entrenar.
  window.addEventListener("load", () => {
    trainBrain();
    els.userInput.focus();
  });
})();
