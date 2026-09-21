(() => {
  "use strict";

  // ============================================================
  // Logic AI Level 3.1
  // - Brain.js local intent classifier (no pretrained language model)
  // - Wikipedia concept synthesis
  // - Emoji emotion recognition
  // - 5 models: Flash / Thinking / Media View / Live / Virtual Art
  // - Media OCR with Tesseract.js + approximate Wikimedia color matching
  // - 12-language response layer + timed Flash/Thinking processing
  // - Virtual Art: Wikimedia Commons layered composition on Canvas
  // - Semantic Engine 2.0 + semantic memory + concept graph
  // - Coreference resolution + uncertainty awareness + correction learning
  // - User preference adaptation + automatic math/time/weather tools
  // - Thinking response planner (visible plan, not hidden chain-of-thought)
  // - Offline learned knowledge cache + cosine similarity semantic vectors
  // - Language Generator 1.0 + explicit Reasoning Engine 1.0
  // ============================================================

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const state = {
    model: (localStorage.getItem("logic-ai-model") === "work" ? "flash" : (localStorage.getItem("logic-ai-model") || "flash")),
    language: localStorage.getItem("logic-ai-language") || "auto",
    activeLanguage: "es",
    network: null,
    brainReady: false,
    isBusy: false,
    voices: [],
    emotion: { name: "Neutral", emoji: "🙂", tone: "neutral" },
    customTraining: loadJSON("logic-ai-training", []),
    chats: loadJSON("logic-ai-chats", []),
    activeChatId: localStorage.getItem("logic-ai-active-chat") || "",
    lastTopic: "",
    tesseractBusy: false,
    responseStrategy: "combine",
    liveRecognition: null,
    liveActive: false,
    liveProcessing: false,
    artBusy: false,
    artObjectUrl: "",
    semanticMemory: loadJSON("logic-ai-semantic-memory", []),
    conceptGraph: loadJSON("logic-ai-concept-graph", {}),
    corrections: loadJSON("logic-ai-corrections", []),
    preferences: loadJSON("logic-ai-preferences", {length:"normal",emojis:true,tone:"casual",detail:"balanced",language:"auto"}),
    lastSemantic: null,
    lastPlan: [],
    lastUncertainty: null,
    offlineKnowledge: loadJSON("logic-ai-offline-knowledge", []),
    reasoningFacts: loadJSON("logic-ai-reasoning-facts", []),
    networkOnline: typeof navigator === "undefined" ? true : navigator.onLine
  };

  const els = {
    brainDot: $("#brainDot"), brainStatus: $("#brainStatus"),
    modelTitle: $("#modelTitle"), modelEyebrow: $("#modelEyebrow"),
    emotionPill: $("#emotionPill"), chatWrap: $("#chatWrap"),
    mediaPanel: $("#mediaPanel"), artPanel: $("#artPanel"), livePanel: $("#livePanel"), trainingPanel: $("#trainingPanel"),
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
    voiceOrb: $("#voiceOrb"), liveStatus: $("#liveStatus"), liveTranscript: $("#liveTranscript"),
    liveStartBtn: $("#liveStartBtn"), liveStopBtn: $("#liveStopBtn"), liveSupport: $("#liveSupport"),
    languageSelect: $("#languageSelect"),
    artPrompt: $("#artPrompt"), artGenerateBtn: $("#artGenerateBtn"), artProgressWrap: $("#artProgressWrap"),
    artProgressLabel: $("#artProgressLabel"), artProgressBar: $("#artProgressBar"), artResult: $("#artResult"),
    networkDot: $("#networkDot"), networkStatus: $("#networkStatus")
  };

  const MODEL_META = {
    flash: { title: "Flash 1.1", eyebrow: "FAST 1–3 SECOND SYNTHESIS", hint: "Procesamiento rápido: entre 1 y 3 segundos, con síntesis o comparación adaptativa." },
    thinking: { title: "Thinking 1.1", eyebrow: "MULTI-PASS 4–20 SECOND ANALYSIS", hint: "Hace de 2 a 10 pasadas de análisis, aproximadamente 2 segundos por pasada." },
    media: { title: "Media View 1.1", eyebrow: "ADAPTIVE VISUAL ANALYSIS", hint: "Analiza fotos y video con OCR, color y candidatos de Wikimedia." },
    live: { title: "Live 1.0", eyebrow: "VOICE CONVERSATION", hint: "Conversación continua por voz con reconocimiento y TextToSpeech." },
    art: { title: "Virtual Art 1.0", eyebrow: "LAYERED WIKIMEDIA IMAGE COMPOSITION", hint: "Genera una composición nueva colocando imágenes de Wikimedia Commons capa por capa." }
  };

  const INTENTS = ["greeting","wellbeing","definition","explanation","person","time","conversation","search"];
  const BASE_TRAINING = [
    ["hola","greeting"],["buenas","greeting"],["hey logic","greeting"],["buen dia","greeting"],
    ["como estas","wellbeing"],["que tal estas","wellbeing"],["como te va","wellbeing"],
    ["que es una calculadora","definition"],["que significa gravedad","definition"],["define algoritmo","definition"],
    ["como funciona una calculadora","explanation"],["por que marte es rojo","explanation"],["explicame internet","explanation"],
    ["quien fue einstein","person"],["quien es ada lovelace","person"],["biografia de tesla","person"],
    ["cuando nacio einstein","time"],["en que ano ocurrio","time"],
    ["gracias","conversation"],["genial","conversation"],["cuentame mas","conversation"],["quien eres","conversation"],
    ["busca wikipedia sobre saturno","search"],["investiga volcanes","search"],["quiero informacion sobre japon","search"],
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

  // Spanish + 11 additional languages. Wikipedia and Web Speech use the selected/detected language.
  const LANGUAGES = {
    es:{name:"Español",wiki:"es",speech:"es-ES",markers:["hola","que","como","quiero","dime","una","para","gracias"],
      greeting:"¡Hola! 👋 Soy Logic AI. ¿Qué quieres explorar?", wellbeing:"¡Muy bien! 😄 Estoy listo. ¿Cómo estás tú?", thanks:"¡De nada! 😄",
      identity:"Soy Logic AI: combino Brain.js, reglas, memoria local y conocimiento de Wikipedia.", listen:"Te escucho. Puedes preguntarme algo concreto o continuar con el tema anterior.",
      neutral:"Claro. ", happy:"¡Claro! 😄 ", excited:"¡Sí! 🤩 ", sad:"Entiendo 😔. ", worried:"Entiendo la preocupación 😟. ", angry:"Veo que esto te molesta 😠. ", confused:"Claro, lo ordeno 🤔: ", amused:"😂 Dale. ",
      besides:"además", and:"y", contrast:"En cambio", shared:"Coinciden en conceptos como", followExplain:"Si quieres, puedo explorar más a fondo cómo funciona o darte un ejemplo.", followDefine:"Si quieres, puedo ampliar la explicación.", unavailable:"No pude obtener suficiente información de Wikipedia ahora mismo."},
    en:{name:"English",wiki:"en",speech:"en-US",markers:["hello","what","how","tell","please","the","is","are","thanks"],
      greeting:"Hello! 👋 I'm Logic AI. What would you like to explore?", wellbeing:"I'm doing great! 😄 Ready when you are. How are you?", thanks:"You're welcome! 😄",
      identity:"I'm Logic AI: I combine Brain.js, rules, local memory, and Wikipedia knowledge.", listen:"I'm listening. Ask something specific or continue the previous topic.",
      neutral:"Sure. ", happy:"Absolutely! 😄 ", excited:"Yes! 🤩 ", sad:"I understand 😔. ", worried:"I understand the concern 😟. ", angry:"I can see this is frustrating 😠. ", confused:"Sure, let's organize it 🤔: ", amused:"😂 Sure. ",
      besides:"also", and:"and", contrast:"In contrast", shared:"They share concepts such as", followExplain:"If you want, I can explore how it works in more detail or give an example.", followDefine:"If you want, I can expand the explanation.", unavailable:"I couldn't retrieve enough information from Wikipedia right now."},
    he:{name:"עברית",wiki:"he",speech:"he-IL",markers:["שלום","מה","איך","למה","תסביר","תודה"],
      greeting:"שלום! 👋 אני Logic AI. מה תרצה לחקור?", wellbeing:"מצוין! 😄 אני מוכן. מה שלומך?", thanks:"בשמחה! 😄", identity:"אני Logic AI: משלב Brain.js, כללים, זיכרון מקומי וידע מוויקיפדיה.", listen:"אני מקשיב. אפשר לשאול שאלה ממוקדת או להמשיך את הנושא הקודם.",
      neutral:"בטח. ", happy:"בשמחה! 😄 ", excited:"כן! 🤩 ", sad:"אני מבין 😔. ", worried:"אני מבין את הדאגה 😟. ", angry:"אני רואה שזה מתסכל 😠. ", confused:"ברור, נעשה סדר 🤔: ", amused:"😂 בסדר. ",
      besides:"בנוסף", and:"ו", contrast:"לעומת זאת", shared:"יש להם מושגים משותפים כמו", followExplain:"אם תרצה, אוכל להעמיק בדרך הפעולה או לתת דוגמה.", followDefine:"אם תרצה, אוכל להרחיב את ההסבר.", unavailable:"לא הצלחתי לקבל כרגע מספיק מידע מוויקיפדיה."},
    fr:{name:"Français",wiki:"fr",speech:"fr-FR",markers:["bonjour","quoi","comment","pourquoi","explique","merci","une","des"],
      greeting:"Bonjour ! 👋 Je suis Logic AI. Que veux-tu explorer ?", wellbeing:"Très bien ! 😄 Je suis prêt. Et toi ?", thanks:"Avec plaisir ! 😄", identity:"Je suis Logic AI : je combine Brain.js, des règles, une mémoire locale et Wikipédia.", listen:"Je t'écoute. Pose une question précise ou continue le sujet précédent.",
      neutral:"Bien sûr. ", happy:"Bien sûr ! 😄 ", excited:"Oui ! 🤩 ", sad:"Je comprends 😔. ", worried:"Je comprends l'inquiétude 😟. ", angry:"Je vois que c'est frustrant 😠. ", confused:"D'accord, organisons cela 🤔 : ", amused:"😂 D'accord. ",
      besides:"de plus", and:"et", contrast:"En revanche", shared:"Ils partagent des notions comme", followExplain:"Si tu veux, je peux approfondir son fonctionnement ou donner un exemple.", followDefine:"Si tu veux, je peux développer l'explication.", unavailable:"Je n'ai pas pu récupérer assez d'informations de Wikipédia pour le moment."},
    de:{name:"Deutsch",wiki:"de",speech:"de-DE",markers:["hallo","was","wie","warum","erklare","danke","der","die","das"],
      greeting:"Hallo! 👋 Ich bin Logic AI. Was möchtest du erkunden?", wellbeing:"Sehr gut! 😄 Ich bin bereit. Wie geht es dir?", thanks:"Gern! 😄", identity:"Ich bin Logic AI: Ich kombiniere Brain.js, Regeln, lokalen Speicher und Wikipedia-Wissen.", listen:"Ich höre zu. Stell eine konkrete Frage oder setze das vorherige Thema fort.",
      neutral:"Klar. ", happy:"Natürlich! 😄 ", excited:"Ja! 🤩 ", sad:"Ich verstehe 😔. ", worried:"Ich verstehe die Sorge 😟. ", angry:"Ich sehe, dass das frustrierend ist 😠. ", confused:"Klar, ordnen wir es 🤔: ", amused:"😂 Klar. ",
      besides:"außerdem", and:"und", contrast:"Dagegen", shared:"Gemeinsame Begriffe sind etwa", followExplain:"Wenn du möchtest, kann ich die Funktionsweise genauer erklären oder ein Beispiel geben.", followDefine:"Wenn du möchtest, kann ich die Erklärung erweitern.", unavailable:"Ich konnte gerade nicht genug Informationen aus Wikipedia abrufen."},
    it:{name:"Italiano",wiki:"it",speech:"it-IT",markers:["ciao","cosa","come","perche","spiega","grazie","una","che"],
      greeting:"Ciao! 👋 Sono Logic AI. Cosa vuoi esplorare?", wellbeing:"Benissimo! 😄 Sono pronto. Come stai?", thanks:"Prego! 😄", identity:"Sono Logic AI: combino Brain.js, regole, memoria locale e conoscenza di Wikipedia.", listen:"Ti ascolto. Fai una domanda specifica o continua l'argomento precedente.",
      neutral:"Certo. ", happy:"Certo! 😄 ", excited:"Sì! 🤩 ", sad:"Capisco 😔. ", worried:"Capisco la preoccupazione 😟. ", angry:"Vedo che è frustrante 😠. ", confused:"Certo, mettiamo ordine 🤔: ", amused:"😂 Va bene. ",
      besides:"inoltre", and:"e", contrast:"Invece", shared:"Condividono concetti come", followExplain:"Se vuoi, posso approfondire come funziona o fare un esempio.", followDefine:"Se vuoi, posso ampliare la spiegazione.", unavailable:"Non sono riuscito a recuperare abbastanza informazioni da Wikipedia in questo momento."},
    pt:{name:"Português",wiki:"pt",speech:"pt-BR",markers:["ola","olá","o que","como","porque","explique","obrigado","uma","quero"],
      greeting:"Olá! 👋 Sou o Logic AI. O que você quer explorar?", wellbeing:"Muito bem! 😄 Estou pronto. Como você está?", thanks:"De nada! 😄", identity:"Sou o Logic AI: combino Brain.js, regras, memória local e conhecimento da Wikipédia.", listen:"Estou ouvindo. Faça uma pergunta específica ou continue o assunto anterior.",
      neutral:"Claro. ", happy:"Claro! 😄 ", excited:"Sim! 🤩 ", sad:"Entendo 😔. ", worried:"Entendo a preocupação 😟. ", angry:"Vejo que isso é frustrante 😠. ", confused:"Claro, vamos organizar 🤔: ", amused:"😂 Certo. ",
      besides:"além disso", and:"e", contrast:"Por outro lado", shared:"Eles compartilham conceitos como", followExplain:"Se quiser, posso explorar melhor como funciona ou dar um exemplo.", followDefine:"Se quiser, posso ampliar a explicação.", unavailable:"Não consegui obter informação suficiente da Wikipédia agora."},
    ru:{name:"Русский",wiki:"ru",speech:"ru-RU",markers:["привет","что","как","почему","объясни","спасибо"],
      greeting:"Привет! 👋 Я Logic AI. Что хочешь изучить?", wellbeing:"Отлично! 😄 Я готов. Как ты?", thanks:"Пожалуйста! 😄", identity:"Я Logic AI: объединяю Brain.js, правила, локальную память и знания Википедии.", listen:"Я слушаю. Задай конкретный вопрос или продолжи предыдущую тему.",
      neutral:"Конечно. ", happy:"Конечно! 😄 ", excited:"Да! 🤩 ", sad:"Понимаю 😔. ", worried:"Понимаю беспокойство 😟. ", angry:"Вижу, что это раздражает 😠. ", confused:"Хорошо, разберёмся 🤔: ", amused:"😂 Хорошо. ",
      besides:"кроме того", and:"и", contrast:"В отличие от этого", shared:"У них есть общие понятия, например", followExplain:"Если хочешь, я могу подробнее объяснить, как это работает, или привести пример.", followDefine:"Если хочешь, я могу расширить объяснение.", unavailable:"Сейчас не удалось получить достаточно информации из Википедии."},
    ar:{name:"العربية",wiki:"ar",speech:"ar-SA",markers:["مرحبا","ما","كيف","لماذا","اشرح","شكرا"],
      greeting:"مرحبًا! 👋 أنا Logic AI. ماذا تريد أن نستكشف؟", wellbeing:"بخير جدًا! 😄 أنا جاهز. كيف حالك؟", thanks:"على الرحب والسعة! 😄", identity:"أنا Logic AI: أدمج Brain.js والقواعد والذاكرة المحلية ومعرفة ويكيبيديا.", listen:"أنا أستمع. اسأل سؤالًا محددًا أو تابع الموضوع السابق.",
      neutral:"بالتأكيد. ", happy:"بالتأكيد! 😄 ", excited:"نعم! 🤩 ", sad:"أفهم 😔. ", worried:"أفهم القلق 😟. ", angry:"أرى أن هذا محبط 😠. ", confused:"حسنًا، لنرتب الفكرة 🤔: ", amused:"😂 حسنًا. ",
      besides:"بالإضافة إلى ذلك", and:"و", contrast:"في المقابل", shared:"يشتركان في مفاهيم مثل", followExplain:"إذا أردت، يمكنني شرح طريقة عمله بمزيد من العمق أو إعطاء مثال.", followDefine:"إذا أردت، يمكنني توسيع الشرح.", unavailable:"لم أتمكن من جلب معلومات كافية من ويكيبيديا الآن."},
    ja:{name:"日本語",wiki:"ja",speech:"ja-JP",markers:["こんにちは","何","どう","なぜ","説明","ありがとう"],
      greeting:"こんにちは！👋 Logic AIです。何を調べたいですか？", wellbeing:"元気です！😄 準備できています。あなたはどうですか？", thanks:"どういたしまして！😄", identity:"私はLogic AIです。Brain.js、ルール、ローカルメモリ、Wikipediaの知識を組み合わせます。", listen:"聞いています。具体的な質問をするか、前の話題を続けてください。",
      neutral:"もちろん。", happy:"もちろん！😄 ", excited:"はい！🤩 ", sad:"わかります😔。", worried:"心配ですね😟。", angry:"それは苛立ちますね😠。", confused:"整理しましょう🤔：", amused:"😂 いいですね。",
      besides:"さらに", and:"そして", contrast:"一方で", shared:"共通する概念には", followExplain:"必要なら、仕組みをさらに詳しく説明したり、例を示したりできます。", followDefine:"必要なら説明をさらに広げられます。", unavailable:"現在、Wikipediaから十分な情報を取得できませんでした。"},
    ko:{name:"한국어",wiki:"ko",speech:"ko-KR",markers:["안녕","무엇","어떻게","왜","설명","고마워"],
      greeting:"안녕하세요! 👋 Logic AI입니다. 무엇을 알아볼까요?", wellbeing:"아주 좋아요! 😄 준비됐어요. 당신은 어때요?", thanks:"천만에요! 😄", identity:"저는 Logic AI입니다. Brain.js, 규칙, 로컬 메모리, Wikipedia 지식을 결합합니다.", listen:"듣고 있어요. 구체적으로 질문하거나 이전 주제를 이어가세요.",
      neutral:"물론이죠. ", happy:"물론이죠! 😄 ", excited:"네! 🤩 ", sad:"이해해요 😔. ", worried:"걱정되는군요 😟. ", angry:"답답할 수 있겠네요 😠. ", confused:"좋아요, 정리해 볼게요 🤔: ", amused:"😂 좋아요. ",
      besides:"또한", and:"그리고", contrast:"반면", shared:"공통 개념으로는", followExplain:"원하면 작동 원리를 더 자세히 살펴보거나 예를 들 수 있어요.", followDefine:"원하면 설명을 더 확장할 수 있어요.", unavailable:"지금은 Wikipedia에서 충분한 정보를 가져오지 못했습니다."},
    zh:{name:"中文",wiki:"zh",speech:"zh-CN",markers:["你好","什么","怎么","为什么","解释","谢谢"],
      greeting:"你好！👋 我是 Logic AI。你想探索什么？", wellbeing:"很好！😄 我已经准备好了。你怎么样？", thanks:"不客气！😄", identity:"我是 Logic AI：结合 Brain.js、规则、本地记忆和维基百科知识。", listen:"我在听。你可以问一个具体问题，或继续之前的话题。",
      neutral:"当然。", happy:"当然！😄 ", excited:"好！🤩 ", sad:"我明白 😔。", worried:"我理解你的担心 😟。", angry:"我看得出这很让人沮丧 😠。", confused:"好，我们整理一下 🤔：", amused:"😂 好的。",
      besides:"此外", and:"以及", contrast:"相比之下", shared:"它们共有的概念包括", followExplain:"如果你愿意，我可以更深入解释它的工作方式或举一个例子。", followDefine:"如果你愿意，我可以进一步展开说明。", unavailable:"目前无法从维基百科获取足够的信息。"}
  };

  const LANG_STOP = {
    en:"a an the is are was were be to of in on for with and or from by as at it this that these those i you me my your please tell explain".split(" "),
    fr:"le la les un une des de du et ou en dans pour avec sur ce cette ces je tu vous moi explique".split(" "),
    de:"der die das ein eine und oder von zu im in auf fur mit ich du sie was wie bitte".split(" "),
    it:"il lo la i gli le un una e o di del in su per con io tu che come".split(" "),
    pt:"o a os as um uma e ou de do da em para com eu voce que como quero".split(" ")
  };

  function detectLanguage(text){
    const raw=String(text||"");
    if(/[\u0590-\u05FF]/u.test(raw)) return "he";
    if(/[\u0600-\u06FF]/u.test(raw)) return "ar";
    if(/[\u3040-\u30FF]/u.test(raw)) return "ja";
    if(/[\uAC00-\uD7AF]/u.test(raw)) return "ko";
    if(/[\u0400-\u04FF]/u.test(raw)) return "ru";
    if(/[\u4E00-\u9FFF]/u.test(raw)) return "zh";
    const n=normalize(raw); let best="es",bestScore=0;
    for(const code of ["es","en","fr","de","it","pt"]){let score=0;for(const marker of LANGUAGES[code].markers){if(n.includes(normalize(marker)))score+=marker.includes(" ")?2:1;}if(score>bestScore){best=code;bestScore=score;}}
    return bestScore?best:"es";
  }
  function resolveLanguage(text=""){
    const code=state.language!=="auto"&&LANGUAGES[state.language]?state.language:detectLanguage(text);
    state.activeLanguage=code;document.documentElement.lang=code;return code;
  }
  function lang(code=state.activeLanguage){return LANGUAGES[code]||LANGUAGES.es;}
  function speechLanguage(code=state.activeLanguage){return lang(code).speech;}


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

  function contentTokens(text, code=state.activeLanguage) {
    const extra=new Set(LANG_STOP[code]||[]);
    const tokens=tokenizeAll(text).filter(t=>t.length>1&&!STOP.has(t)&&!extra.has(t)&&!/^\d+$/.test(t));
    if(["ja","zh","ko"].includes(code) && tokens.length<=1 && String(text).trim().length>1) return [String(text).trim()];
    return [...new Set(tokens)];
  }

  function conceptGroups(text, code=state.activeLanguage) {
    const extra=new Set(LANG_STOP[code]||[]);
    const all=tokenizeAll(text);
    const meaningful=all.filter(t=>t.length>1&&!STOP.has(t)&&!extra.has(t));
    if(["ja","zh","ko"].includes(code) && meaningful.length<=1) return [String(text).trim()].filter(Boolean);
    const groups=[];
    for(let n=3;n>=2;n--){for(let i=0;i<=meaningful.length-n;i++){const g=meaningful.slice(i,i+n).join(" ");if(!groups.includes(g))groups.push(g);}}
    meaningful.forEach(t=>{if(!groups.includes(t))groups.push(t);});
    return groups.slice(0,8);
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

  function heuristicIntent(text, code=state.activeLanguage) {
    const n=normalize(text),raw=String(text).toLowerCase();
    const patterns={
      es:{g:/^(hola|buenas|hey|holi|buen dia)/,w:/\b(como estas|que tal estas|como te va)\b/,e:/^(por que|explica|explicame|como funciona|como se forma)/,d:/^(que es|que significa|define)/,p:/^(quien es|quien fue|quien era|biografia)/,t:/^(cuando|en que ano|en que fecha)/,s:/\b(busca|investiga|wikipedia|informacion)\b/},
      en:{g:/^(hello|hi|hey|good morning|good evening)/,w:/\b(how are you|how is it going)\b/,e:/^(why|explain|how does|how do|how is .* made)/,d:/^(what is|what are|define|what does .* mean)/,p:/^(who is|who was|biography)/,t:/^(when|what year|what date)/,s:/\b(search|look up|research|wikipedia|information)\b/},
      fr:{g:/^(bonjour|salut|coucou)/,w:/\b(comment vas tu|comment allez vous|ca va)\b/,e:/^(pourquoi|explique|comment fonctionne)/,d:/^(qu est ce que|c est quoi|definis|definition)/,p:/^(qui est|qui etait|biographie)/,t:/^(quand|en quelle annee)/,s:/\b(cherche|recherche|wikipedia|information)\b/},
      de:{g:/^(hallo|guten morgen|guten tag)/,w:/\b(wie geht es dir|wie geht s)\b/,e:/^(warum|erklare|wie funktioniert)/,d:/^(was ist|definiere|was bedeutet)/,p:/^(wer ist|wer war|biografie)/,t:/^(wann|in welchem jahr)/,s:/\b(suche|recherchiere|wikipedia|information)\b/},
      it:{g:/^(ciao|salve|buongiorno)/,w:/\b(come stai|come va)\b/,e:/^(perche|spiega|come funziona)/,d:/^(cos e|che cos e|definisci|cosa significa)/,p:/^(chi e|chi era|biografia)/,t:/^(quando|in che anno)/,s:/\b(cerca|ricerca|wikipedia|informazioni)\b/},
      pt:{g:/^(ola|oi|bom dia|boa tarde)/,w:/\b(como voce esta|como esta|tudo bem)\b/,e:/^(por que|porque|explique|como funciona)/,d:/^(o que e|defina|o que significa)/,p:/^(quem e|quem foi|biografia)/,t:/^(quando|em que ano)/,s:/\b(pesquise|procure|wikipedia|informacao)\b/}
    };
    const p=patterns[code];
    if(p){if(p.g.test(n))return"greeting";if(p.w.test(n))return"wellbeing";if(p.e.test(n))return"explanation";if(p.d.test(n))return"definition";if(p.p.test(n))return"person";if(p.t.test(n))return"time";if(p.s.test(n))return"search";}
    if(code==="he"){if(/^(שלום|היי)/.test(raw))return"greeting";if(/מה שלומך|איך אתה|איך את/.test(raw))return"wellbeing";if(/^(למה|תסביר|איך .* עובד)/.test(raw))return"explanation";if(/^(מה זה|מהו|מהי)/.test(raw))return"definition";if(/^(מי זה|מי היה|מי היא)/.test(raw))return"person";if(/^(מתי|באיזו שנה)/.test(raw))return"time";}
    if(code==="ar"){if(/^(مرحبا|أهلا|اهلا)/.test(raw))return"greeting";if(/كيف حالك/.test(raw))return"wellbeing";if(/^(لماذا|اشرح|كيف يعمل)/.test(raw))return"explanation";if(/^(ما هو|ما هي|ما معنى)/.test(raw))return"definition";if(/^(من هو|من هي|من كان)/.test(raw))return"person";if(/^(متى|في أي سنة)/.test(raw))return"time";}
    if(code==="ru"){if(/^(привет|здравствуй)/.test(raw))return"greeting";if(/как дела/.test(raw))return"wellbeing";if(/^(почему|объясни|как работает)/.test(raw))return"explanation";if(/^(что такое|что значит|определи)/.test(raw))return"definition";if(/^(кто такой|кто такая|кто был)/.test(raw))return"person";if(/^(когда|в каком году)/.test(raw))return"time";}
    if(code==="ja"){if(/^(こんにちは|やあ)/.test(raw))return"greeting";if(/元気/.test(raw))return"wellbeing";if(/^(なぜ|どうして|説明|.*仕組み)/.test(raw))return"explanation";if(/^(.*とは|何ですか|何)/.test(raw))return"definition";if(/^(誰|だれ)/.test(raw))return"person";if(/^(いつ|何年)/.test(raw))return"time";}
    if(code==="ko"){if(/^(안녕|안녕하세요)/.test(raw))return"greeting";if(/어떻게 지내|잘 지내/.test(raw))return"wellbeing";if(/^(왜|설명|어떻게 작동)/.test(raw))return"explanation";if(/^(무엇|뭐야|정의)/.test(raw))return"definition";if(/^(누구|누가)/.test(raw))return"person";if(/^(언제|몇 년)/.test(raw))return"time";}
    if(code==="zh"){if(/^(你好|嗨)/.test(raw))return"greeting";if(/你好吗|怎么样/.test(raw))return"wellbeing";if(/^(为什么|解释|怎么工作|如何工作)/.test(raw))return"explanation";if(/^(什么是|是什么意思|定义)/.test(raw))return"definition";if(/^(谁是|谁)/.test(raw))return"person";if(/^(什么时候|哪一年)/.test(raw))return"time";}
    return "conversation";
  }

  function classifyIntent(text, code=state.activeLanguage) {
    const h=heuristicIntent(text,code);
    if(code!=="es") return {intent:h,confidence:.72,engine:`reglas ${LANGUAGES[code]?.name||code}`};
    if(!state.brainReady||!state.network)return{intent:h,confidence:.55,engine:"reglas"};
    try{const out=state.network.run(vectorize(text));const [intent,confidence]=Object.entries(out).sort((a,b)=>b[1]-a[1])[0]||[h,.5];const strong=/^(que es|por que|como funciona|quien|cuando|hola)/.test(normalize(text));return{intent:strong?h:(confidence>.4?intent:h),confidence,engine:strong?"Brain.js + reglas":"Brain.js"};}catch{return{intent:h,confidence:.5,engine:"reglas"};}
  }

  function detectEmotion(text) {
    for (const e of EMOTIONS) if (e.tests.some(re => re.test(text))) return e;
    return { name:"Neutral", emoji:"🙂", tone:"neutral" };
  }

  function topicEmoji(text) {
    for (const [re,emoji] of TOPIC_EMOJIS) if (re.test(text)) return emoji;
    return "💡";
  }


  // --------------------------- Cognitive layer ---------------------------
  // Semantic Engine 2.0 builds a small structured representation. It is not an LLM;
  // it combines rules, learned intent, local memory and a concept graph.
  function semanticEngine2(text, code=state.activeLanguage) {
    const raw=String(text||"");
    const n=normalize(raw);
    const tokens=tokenizeAll(raw);
    const concepts=contentTokens(raw,code);
    const groups=conceptGroups(raw,code);
    const compare=decideResponseStrategy(raw)==="compare";
    let action="discuss";
    if(isMathRequest(raw))action="calculate";
    else if(isTimeRequest(raw))action="time";
    else if(isWeatherRequest(raw))action="weather";
    else if(compare)action="compare";
    else if(/^(por que|explica|explicame|como funciona|why|explain|how does|how do)/.test(n))action="explain";
    else if(/^(que es|que significa|define|what is|what are|define)/.test(n))action="define";
    else if(/\b(busca|investiga|search|research|wikipedia)\b/.test(n))action="search";
    const corefPattern=/\b(eso|esto|ese|esa|aquel|aquella|el|ella|ellos|ellas|su|sus|lo anterior|it|its|that|this|they|them|he|she|זה|הוא|היא|שלו|ذلك|هذا|هو|هي|それ|これ|그것|이것|它|这个)\b/iu;
    const hasCoreference=corefPattern.test(raw)||(/\b(tiene|tenia|funciona|sirve|does it|is it|has it)\b/i.test(n)&&concepts.length<=5);
    const temporal=(raw.match(/\b(hoy|ayer|mañana|ahora|today|yesterday|tomorrow|now|esta semana|this week)\b/i)||[])[0]||"";
    const negated=/\b(no|nunca|sin|not|never|without|לא|ليس|не|ない|아니|不)\b/iu.test(raw);
    const namedNumbers=(raw.match(/-?\d+(?:[.,]\d+)?/g)||[]).map(x=>Number(x.replace(",","."))).filter(Number.isFinite);
    const primaryTopic=groups.find(g=>g.includes(" "))||concepts.slice(0,3).join(" ")||state.lastTopic||"";
    const ambiguity=(hasCoreference&&!state.lastTopic?0.45:0)+(concepts.length===0&&/[?¿]/.test(raw)?0.35:0)+(compare&&extractComparisonSubjects(raw).length<2?0.35:0);
    const confidence=Math.max(.15,Math.min(.98,.92-ambiguity-(concepts.length===1?.08:0)));
    const semantic={raw,normalized:n,language:code,tokens,concepts,groups,action,compare,hasCoreference,temporal,negated,numbers:namedNumbers,primaryTopic,confidence};
    state.lastSemantic=semantic;
    return semantic;
  }

  function resolveCoreferences(text, semantic=semanticEngine2(text)) {
    const remembered=state.lastTopic||bestSemanticTopic(text);
    if(!semantic.hasCoreference)return{text,resolvedTopic:"",used:false};
    if(!remembered)return{text,resolvedTopic:"",used:false,unresolved:true};
    const already=normalize(text).includes(normalize(remembered));
    return {text:already?text:`${remembered}. ${text}`,resolvedTopic:remembered,used:!already};
  }

  function memoryKeywords(value){return [...new Set(contentTokens(String(value||""),state.activeLanguage))].slice(0,18);}
  function persistSemanticSystems(){
    state.semanticMemory=(state.semanticMemory||[]).sort((a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||""))).slice(0,350);
    state.corrections=(state.corrections||[]).sort((a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||""))).slice(0,120);
    const entries=Object.entries(state.conceptGraph||{}).sort((a,b)=>(b[1]?.updated||0)-(a[1]?.updated||0)).slice(0,220);
    state.conceptGraph=Object.fromEntries(entries);
    saveJSON("logic-ai-semantic-memory",state.semanticMemory);saveJSON("logic-ai-concept-graph",state.conceptGraph);saveJSON("logic-ai-corrections",state.corrections);saveJSON("logic-ai-preferences",state.preferences);
  }

  function rememberSemantic(item){
    if(!item||!item.subject)return;
    const sensitive=/password|contraseña|contrasena|token|api key|secret|cvv|tarjeta|credit card/i.test(`${item.subject} ${item.object||""}`);
    if(sensitive)return;
    const key=normalize(`${item.type||"fact"}|${item.subject}|${item.predicate||""}`);
    const existing=state.semanticMemory.find(x=>x.key===key);
    const record={id:existing?.id||`mem-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,key,type:item.type||"fact",subject:item.subject,predicate:item.predicate||"related",object:item.object||"",keywords:item.keywords||memoryKeywords(`${item.subject} ${item.object||""}`),confidence:item.confidence??.7,source:item.source||"conversation",updatedAt:nowISO()};
    if(existing)Object.assign(existing,record);else state.semanticMemory.unshift(record);
    persistSemanticSystems();
  }

  function observeSemanticInput(text, semantic){
    if(!semantic||!String(text).trim())return;
    if(semantic.primaryTopic)rememberSemantic({type:"topic",subject:semantic.primaryTopic,predicate:"discussed",object:text.slice(0,180),keywords:semantic.concepts,confidence:.6});
    const n=String(text).trim();
    const factPatterns=[
      /^(?:mi|my)\s+(.{2,40}?)\s+(?:es|is)\s+(.{2,120})[.!]?$/i,
      /^(?:tengo|i have)\s+(.{2,140})[.!]?$/i,
      /^(?:estoy (?:haciendo|creando)|i am (?:making|building))\s+(.{2,140})[.!]?$/i,
      /^(?:me gusta|me interesa|i like|i am interested in)\s+(.{2,140})[.!]?$/i
    ];
    for(const re of factPatterns){const m=n.match(re);if(m){rememberSemantic({type:"fact",subject:m[1]||semantic.primaryTopic||"user",predicate:m[2]?"is":"has",object:m[2]||m[1],confidence:.78});break;}}
    updateConceptGraph(semantic.concepts,semantic.primaryTopic);
  }

  // Sparse semantic vectors made by Logic itself. No pretrained embeddings are used.
  function sparseVectorFromTerms(terms=[], weight=1){const v={};for(const raw of terms||[]){const k=normalize(raw);if(!k)continue;v[k]=(v[k]||0)+weight;}return v;}
  function buildSemanticVector(text, code=state.activeLanguage, includeGraph=true){const tokens=contentTokens(text,code),groups=conceptGroups(text,code).filter(x=>x.includes(" ")).slice(0,5),v=sparseVectorFromTerms(tokens,1);for(const g of groups)v[normalize(g)]=(v[normalize(g)]||0)+1.45;if(includeGraph){for(const related of graphRelated(tokens,6))v[normalize(related)]=(v[normalize(related)]||0)+.32;}return v;}
  function cosineSimilarityVectors(a={},b={}){const ak=Object.keys(a),bk=Object.keys(b);if(!ak.length||!bk.length)return 0;let dot=0,na=0,nb=0;for(const k of ak){const x=Number(a[k])||0;na+=x*x;if(b[k]!=null)dot+=x*(Number(b[k])||0);}for(const k of bk){const y=Number(b[k])||0;nb+=y*y;}return na&&nb?dot/(Math.sqrt(na)*Math.sqrt(nb)):0;}
  function semanticSimilarity(a=[],b=[]){return cosineSimilarityVectors(sparseVectorFromTerms(a),sparseVectorFromTerms(b));}
  function recallSemanticMemory(text,limit=5){const qv=buildSemanticVector(text,state.activeLanguage);return (state.semanticMemory||[]).map(m=>{const mv=sparseVectorFromTerms(m.keywords||[]),cos=cosineSimilarityVectors(qv,mv),exact=normalize(text).includes(normalize(m.subject))?.35:0;return{...m,score:Math.min(1,cos+exact),cosine:cos};}).filter(x=>x.score>.08).sort((a,b)=>b.score-a.score).slice(0,limit);}
  function bestSemanticTopic(text){const m=recallSemanticMemory(text,1)[0];return m?.subject||"";}

  function updateConceptGraph(concepts=[],topic=""){
    const nodes=[...new Set([...concepts,...memoryKeywords(topic)].filter(x=>x&&x.length>1))].slice(0,12);
    const g=state.conceptGraph||{};const ts=Date.now();
    nodes.forEach(a=>{g[a]??={neighbors:{},updated:ts};g[a].updated=ts;nodes.forEach(b=>{if(a===b)return;g[a].neighbors[b]=Math.min(50,(g[a].neighbors[b]||0)+1);});});
    state.conceptGraph=g;persistSemanticSystems();
  }
  function graphRelated(concepts=[],limit=5){
    const scores={};for(const c of concepts){const node=state.conceptGraph?.[c];if(!node)continue;for(const [n,w] of Object.entries(node.neighbors||{}))scores[n]=(scores[n]||0)+w;}
    return Object.entries(scores).filter(([x])=>!concepts.includes(x)).sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([x])=>x);
  }

  function previousExchange(){
    const msgs=ensureChat().messages||[];let ai=-1;for(let i=msgs.length-1;i>=0;i--){if(msgs[i].role==="ai"){ai=i;break;}}
    if(ai<0)return null;let user=-1;for(let i=ai-1;i>=0;i--){if(msgs[i].role==="user"){user=i;break;}}
    return user>=0?{question:msgs[user].text,answer:msgs[ai].text,topic:msgs[ai].topic||msgs[user].topic||""}:null;
  }
  function correctionPayload(text){
    const raw=String(text||"").trim();const n=normalize(raw);
    const signal=/^(correccion|corrección|te corrijo|no[,!.](?:\s|$)|no\s+(?:eso|esta|está|es|quise|queria|quería|me referia|me refería)|eso esta mal|eso está mal|incorrecto|equivocado|actually|correction|that's wrong|that is wrong)/i.test(raw)||/\b(quis(?:e|iste) decir|la respuesta correcta|should be|deberia ser|debería ser)\b/i.test(n);
    if(!signal)return null;
    let content=raw;
    if(raw.includes(":"))content=raw.slice(raw.indexOf(":")+1).trim();
    content=content.replace(/^(?:no[,!.]?\s*)?(?:eso\s+)?(?:esta|está|es)?\s*(?:mal|incorrecto|equivocado)?[,!.;:\s]*/i,"").replace(/^(?:correccion|corrección|te corrijo)[,!.;:\s]*/i,"").trim();
    if(content.length<4||/^(eso|no|incorrecto)$/i.test(content))content="";
    return {content};
  }
  function learnCorrection(text){
    const payload=correctionPayload(text);if(!payload)return null;const prev=previousExchange();
    if(!prev||!payload.content)return{learned:false,needsDetail:true};
    const record={id:`corr-${Date.now()}`,question:prev.question,oldAnswer:prev.answer,correction:payload.content,triggerTokens:memoryKeywords(prev.question),topic:prev.topic||bestSemanticTopic(prev.question)||state.lastTopic,updatedAt:nowISO()};
    state.corrections.unshift(record);rememberSemantic({type:"correction",subject:record.topic||prev.question.slice(0,80),predicate:"corrected_as",object:payload.content,keywords:record.triggerTokens,confidence:.9,source:"user_correction"});persistSemanticSystems();
    return{learned:true,record};
  }
  function recallCorrection(text){
    const q=memoryKeywords(text);let best=null;for(const c of state.corrections||[]){const score=semanticSimilarity(q,c.triggerTokens||[])+(c.topic&&normalize(text).includes(normalize(c.topic))?.35:0);if(!best||score>best.score)best={...c,score};}
    return best&&best.score>=.34?best:null;
  }

  function inferPreferences(text){
    const n=normalize(text);const changes=[];const p={...state.preferences};
    const set=(key,value,label)=>{if(p[key]!==value){p[key]=value;changes.push(label);}};
    if(/\b(respuestas?|respuesta) (muy )?(cortas?|breves?)\b|\bse breve\b|\bbe concise\b|\bshort answers?\b/.test(n))set("length","short","respuestas breves");
    if(/\b(respuestas?|respuesta) (mas )?(largas?|detalladas?|completas?)\b|\bexplica (mas|en detalle)\b|\bdetailed answers?\b/.test(n))set("length","detailed","respuestas detalladas");
    if(/\b(no uses|sin) (tantos )?emojis?\b|\bno emojis?\b|\bwithout emojis?\b/.test(n))set("emojis",false,"sin emojis");
    if(/\b(usa|pon) (mas )?emojis?\b|\buse emojis?\b/.test(n))set("emojis",true,"usar emojis");
    if(/\b(mas formal|tono formal|hablame formal|formal tone)\b/.test(n))set("tone","formal","tono formal");
    if(/\b(mas casual|informal|tono casual|hablame normal|casual tone)\b/.test(n))set("tone","casual","tono casual");
    if(/\b(responde|respondeme|respóndeme|contestame|contéstame) (corto|breve)\b|\bkeep (?:it )?short\b/.test(n))set("length","short","respuestas breves");
    if(/\b(responde|respondeme|respóndeme|contestame|contéstame) (con detalle|detallado|largo)\b|\bbe detailed\b/.test(n))set("length","detailed","respuestas detalladas");
    const languageNames={es:["espanol","español","spanish"],en:["ingles","inglés","english"],he:["hebreo","hebrew"],fr:["frances","francés","french"],de:["aleman","alemán","german"],it:["italiano","italian"],pt:["portugues","portugués","portuguese"],ru:["ruso","russian"],ar:["arabe","árabe","arabic"],ja:["japones","japonés","japanese"],ko:["coreano","korean"],zh:["chino","chinese"]};
    if(/\b(responde|respondeme|respóndeme|hablame|háblame|reply|answer|speak)\b/.test(n)){for(const [lc,names] of Object.entries(languageNames)){if(names.some(name=>n.includes(normalize(name)))){p.language=lc;state.language=lc;localStorage.setItem("logic-ai-language",lc);if(els.languageSelect)els.languageSelect.value=lc;changes.push(`idioma ${LANGUAGES[lc].name}`);break;}}}
    if(changes.length){state.preferences=p;rememberSemantic({type:"preference",subject:"response_style",predicate:"prefers",object:JSON.stringify(p),keywords:["preference","style"],confidence:.95});persistSemanticSystems();}
    return changes;
  }
  function applyPreferences(text){
    let out=String(text||"");const p=state.preferences||{};
    if(p.length==="short"){const sentences=out.split(/(?<=[.!?。！？])\s+/).filter(Boolean);out=sentences.slice(0,2).join(" ");}
    if(p.tone==="formal"&&state.activeLanguage==="es")out=out.replace(/¡Claro!?/g,"Claro.").replace(/Si quieres/g,"Si lo desea").replace(/puedo/g,"puedo");
    if(p.emojis===false)out=out.replace(/[\p{Extended_Pictographic}\uFE0F]/gu,"").replace(/\s{2,}/g," ").trim();
    return out;
  }

  function buildResponsePlan(text,semantic,classification,strategy,toolName=""){
    const recalled=recallSemanticMemory(text,2);const graph=graphRelated(semantic.concepts,3);const plan=[];
    plan.push(`Objetivo: ${semantic.action} · intención ${classification.intent}.`);
    if(semantic.hasCoreference)plan.push(`Contexto: resolver referencias con ${state.lastTopic||bestSemanticTopic(text)||"contexto insuficiente"}.`);
    plan.push(`Estrategia: ${strategy==="compare"?"comparar conceptos por separado":"sintetizar conceptos compatibles"}.`);
    if(toolName)plan.push(`Herramienta: ${toolName}.`);else plan.push(`Conocimiento: memoria semántica + cosine similarity + Reasoning Engine + ${isOnline()?"Wikipedia cuando haga falta":"cache aprendido offline"}.`);
    if(recalled.length)plan.push(`Memoria relevante: ${recalled.map(x=>x.subject).join(" · ")}.`);
    if(graph.length)plan.push(`Conceptos relacionados del grafo: ${graph.join(" · ")}.`);
    plan.push(`Formato: ${state.preferences.length||"normal"}, tono ${state.preferences.tone||"casual"}${state.preferences.emojis===false?", sin emojis":""}.`);
    return plan;
  }

  function assessUncertainty(text,semantic,classification,resolution){
    let score=Math.max(0,1-(semantic.confidence||.5));const reasons=[];
    if(semantic.hasCoreference&&!resolution.resolvedTopic){score+=.5;reasons.push("referencia sin antecedente");}
    if(classification.confidence<.42){score+=.2;reasons.push("intención poco clara");}
    if(semantic.compare&&extractComparisonSubjects(text).length<2){score+=.35;reasons.push("faltan dos elementos para comparar");}
    if(semantic.concepts.length===0&&/[?¿]/.test(text)){score+=.25;reasons.push("no detecté un tema concreto");}
    score=Math.min(1,score);
    let question="";
    if(score>=.62){
      if(semantic.hasCoreference&&!resolution.resolvedTopic)question="No estoy seguro de a qué te refieres con esa referencia. ¿Puedes nombrar el tema o la persona?";
      else if(semantic.compare)question="No estoy seguro de cuáles son los dos elementos que quieres comparar. ¿Puedes nombrarlos?";
      else question="No estoy completamente seguro de qué necesitas. ¿Puedes reformularlo con un poco más de contexto?";
    }
    const result={score,reasons,needsClarification:Boolean(question),question};state.lastUncertainty=result;return result;
  }

  // --------------------------- Offline learning + reasoning ---------------------------
  function isOnline(){return typeof navigator==="undefined"?true:navigator.onLine!==false;}
  function requiresFreshOnlineData(text){const n=normalize(text);return /\b(hoy|ahora|actual|actualmente|ultimo|ultima|ultimos|ultimas|reciente|latest|current|currently|today|now|breaking|esta semana|this week|precio actual|current price|resultado de hoy|score today)\b/.test(n)||isWeatherRequest(text);}
  function updateNetworkUI(){state.networkOnline=isOnline();if(!els.networkDot||!els.networkStatus)return;els.networkDot.className=`dot ${state.networkOnline?"ready":"error"}`;els.networkStatus.textContent=state.networkOnline?"Online · aprendizaje web activo":"Offline · solo conocimiento aprendido";}
  function persistLearnedKnowledge(){state.offlineKnowledge=(state.offlineKnowledge||[]).sort((a,b)=>String(b.learnedAt||"").localeCompare(String(a.learnedAt||""))).slice(0,90);state.reasoningFacts=(state.reasoningFacts||[]).sort((a,b)=>(b.updated||0)-(a.updated||0)).slice(0,700);saveJSON("logic-ai-offline-knowledge",state.offlineKnowledge);saveJSON("logic-ai-reasoning-facts",state.reasoningFacts);}
  function compactText(text,max=1200){return String(text||"").replace(/\s+/g," ").trim().slice(0,max);}
  function cleanEntityPhrase(text){return compactText(text,140).replace(/^[,;:\s]+|[,;:\s]+$/g,"").replace(/\s+(?:que|which|who)\s+.*$/i,"").trim();}
  function factKey(f){return normalize(`${f.subject}|${f.relation}|${f.object}`);}
  function addReasoningFact(f){if(!f?.subject||!f?.object||normalize(f.subject)===normalize(f.object))return;const fact={id:f.id||`fact-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,subject:cleanEntityPhrase(f.subject),relation:f.relation||"related_to",object:cleanEntityPhrase(f.object),confidence:Math.max(.25,Math.min(1,f.confidence??.72)),source:f.source||"learned",sourceUrl:f.sourceUrl||"",language:f.language||state.activeLanguage,inferred:Boolean(f.inferred),updated:Date.now()};if(!fact.subject||!fact.object)return;const key=factKey(fact),existing=(state.reasoningFacts||[]).find(x=>factKey(x)===key);if(existing){if(fact.confidence>existing.confidence)Object.assign(existing,fact);existing.updated=Date.now();}else state.reasoningFacts.unshift(fact);}
  function extractReasoningFacts(sentence,pageTitle="",code=state.activeLanguage){const raw=compactText(sentence,420),out=[];const push=(subject,relation,object,confidence=.78)=>{subject=cleanEntityPhrase(subject||pageTitle);object=cleanEntityPhrase(object);if(subject&&object)out.push({subject,relation,object,confidence,source:pageTitle||"Wikipedia",language:code});};if(code==="es"){let m=raw.match(/^(.{2,90}?)\s+es\s+(?:un|una|el|la)?\s*(.{3,150}?)(?:[.;]|$)/i);if(m)push(m[1],"is_a",m[2],.82);m=raw.match(/^(.{2,90}?)\s+(?:tiene|posee|contiene)\s+(.{3,160}?)(?:[.;]|$)/i);if(m)push(m[1],"has",m[2],.8);m=raw.match(/^(.{2,90}?)\s+(?:usa|utiliza|emplea)\s+(.{3,160}?)(?:[.;]|$)/i);if(m)push(m[1],"uses",m[2],.78);m=raw.match(/^(.{2,90}?)\s+(?:pertenece a|forma parte de)\s+(.{3,150}?)(?:[.;]|$)/i);if(m)push(m[1],"part_of",m[2],.82);m=raw.match(/^(.{2,90}?)\s+(?:causa|provoca|produce)\s+(.{3,160}?)(?:[.;]|$)/i);if(m)push(m[1],"causes",m[2],.75);m=raw.match(/^(.{2,90}?)\s+(?:sirve para|se utiliza para)\s+(.{3,180}?)(?:[.;]|$)/i);if(m)push(m[1],"function",m[2],.82);}else if(code==="en"){let m=raw.match(/^(.{2,90}?)\s+(?:is|are)\s+(?:a|an|the)?\s*(.{3,150}?)(?:[.;]|$)/i);if(m)push(m[1],"is_a",m[2],.82);m=raw.match(/^(.{2,90}?)\s+(?:has|have|contains?)\s+(.{3,160}?)(?:[.;]|$)/i);if(m)push(m[1],"has",m[2],.8);m=raw.match(/^(.{2,90}?)\s+(?:uses?|employs?)\s+(.{3,160}?)(?:[.;]|$)/i);if(m)push(m[1],"uses",m[2],.78);m=raw.match(/^(.{2,90}?)\s+(?:is part of|belongs to)\s+(.{3,150}?)(?:[.;]|$)/i);if(m)push(m[1],"part_of",m[2],.82);m=raw.match(/^(.{2,90}?)\s+(?:causes?|produces?)\s+(.{3,160}?)(?:[.;]|$)/i);if(m)push(m[1],"causes",m[2],.75);m=raw.match(/^(.{2,90}?)\s+(?:is used to|is used for|serves to)\s+(.{3,180}?)(?:[.;]|$)/i);if(m)push(m[1],"function",m[2],.82);}if(!out.length&&pageTitle&&raw.length>35)push(pageTitle,"described_as",raw.slice(0,180),.62);return out;}
  function learnKnowledgeForOffline(query,topic,pages,fragments,code=state.activeLanguage){if(!pages?.length)return;const slimPages=pages.slice(0,4).map(p=>({title:p.title,extract:compactText(p.extract,1300),url:p.url||"",lang:p.lang||code})),slimFragments=(fragments||[]).slice(0,6).map(f=>({sentence:compactText(f.sentence,360),title:f.page?.title||"",url:f.page?.url||""})),keywords=[...new Set([...contentTokens(query,code),...contentTokens(topic,code),...slimPages.flatMap(p=>contentTokens(p.title,code))])].slice(0,24),vector=buildSemanticVector(`${query} ${topic} ${keywords.join(" ")}`,code,false),key=normalize(`${code}|${topic||query}`),entry={id:`learn-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,key,query:compactText(query,220),topic:topic||bestTopicFromQuery(query,slimPages.map(p=>p.title)),language:code,keywords,vector,pages:slimPages,fragments:slimFragments,learnedAt:nowISO(),source:"Wikipedia"};const i=(state.offlineKnowledge||[]).findIndex(x=>x.key===key);if(i>=0)state.offlineKnowledge[i]=entry;else state.offlineKnowledge.unshift(entry);for(const page of slimPages){for(const sentence of splitSentences(page.extract).slice(0,8)){for(const f of extractReasoningFacts(sentence,page.title,code)){f.sourceUrl=page.url;addReasoningFact(f);}}}persistLearnedKnowledge();}
  function recallOfflineKnowledge(text,code=state.activeLanguage,limit=4){const qv=buildSemanticVector(text,code,false),qTokens=new Set(contentTokens(text,code));return(state.offlineKnowledge||[]).filter(x=>x.language===code).map(x=>{const cos=cosineSimilarityVectors(qv,x.vector||sparseVectorFromTerms(x.keywords||[])),overlap=(x.keywords||[]).filter(k=>qTokens.has(k)).length,exact=normalize(x.topic||"").length>2&&normalize(text).includes(normalize(x.topic||""))?.22:0;return{...x,score:Math.min(1,cos+exact+(overlap?Math.min(.12,overlap*.04):0)),cosine:cos,overlap};}).filter(x=>x.score>=.24&&(x.overlap>0||x.score>=.42)).sort((a,b)=>b.score-a.score).slice(0,limit);}
  function factsForQuery(text,code=state.activeLanguage,limit=8){const qv=buildSemanticVector(text,code,false);return(state.reasoningFacts||[]).filter(f=>f.language===code||!f.language).map(f=>({...f,score:cosineSimilarityVectors(qv,buildSemanticVector(`${f.subject} ${f.object}`,code,false))})).filter(f=>f.score>=.18).sort((a,b)=>b.score-a.score).slice(0,limit);}
  function runReasoningEngine(text,semantic,code=state.activeLanguage){const direct=factsForQuery(text,code,10),inferred=[],transitive=new Set(["is_a","part_of"]),all=state.reasoningFacts||[];for(const a of direct){if(!transitive.has(a.relation)||a.confidence<.65)continue;for(const b of all){if(b.relation!==a.relation||b.confidence<.65||normalize(a.object)!==normalize(b.subject))continue;const confidence=a.confidence*b.confidence*.9;if(confidence<.48)continue;const fact={subject:a.subject,relation:a.relation,object:b.object,confidence,inferred:true,support:[a,b],language:code};if(!inferred.some(x=>factKey(x)===factKey(fact)))inferred.push(fact);if(inferred.length>=4)break;}if(inferred.length>=4)break;}const relevant=[...direct.slice(0,5),...inferred],confidence=relevant.length?Math.min(.95,relevant.reduce((a,f)=>a+(f.confidence||.5),0)/relevant.length):0;return{direct:direct.slice(0,5),inferred,relevant,confidence,steps:[direct.length?`Reasoning Engine encontró ${direct.slice(0,5).length} hechos relacionados.`:"Reasoning Engine no encontró hechos locales directos.",inferred.length?`Derivó ${inferred.length} relación(es) transitiva(s) respaldada(s) por hechos aprendidos.`:"No hizo inferencias nuevas sin evidencia suficiente."]};}
  function articleForObject(object){const n=normalize(object);if(/^(un|una|el|la|los|las)\b/.test(n))return"";return/\b(a|as|cion|sion|dad|tad|umbre)$/i.test(n)?"una ":"un ";}
  function renderFact(f,code=state.activeLanguage){const subj=capitalize(f.subject),subjMid=lowerFirst(f.subject),o=f.object;if(code==="es"){const map={is_a:`${subj} es ${articleForObject(o)}${o}`,has:`${subj} tiene ${o}`,uses:`${subj} utiliza ${o}`,part_of:`${subj} forma parte de ${o}`,causes:`${subj} puede causar ${o}`,function:`La función principal de ${subjMid} es ${o}`,described_as:`${subj}: ${o}`};return map[f.relation]||`${subj} se relaciona con ${o}`;}if(code==="en"){const map={is_a:`${subj} is ${/^(a|an|the)\b/i.test(o)?"":"a "}${o}`,has:`${subj} has ${o}`,uses:`${subj} uses ${o}`,part_of:`${subj} is part of ${o}`,causes:`${subj} can cause ${o}`,function:`The main function of ${subjMid} is to ${o}`,described_as:`${subj}: ${o}`};return map[f.relation]||`${subj} is related to ${o}`;}return `${subj}: ${o}`;}
  function languageGenerator(userText,classification,semantic,fragments,reasoning,emotion,code=state.activeLanguage,opts={}){const t=lang(code),topic=bestTopicFromQuery(userText,(fragments||[]).map(f=>f.page?.title||f.title).filter(Boolean)),generatedFacts=[];for(const f of fragments||[]){for(const fact of extractReasoningFacts(f.sentence,f.page?.title||f.title||topic,code)){if(!generatedFacts.some(x=>factKey(x)===factKey(fact)))generatedFacts.push(fact);}}const pool=[...generatedFacts,...(reasoning?.direct||[]),...(reasoning?.inferred||[])],chosen=[];for(const f of pool){if(!chosen.some(x=>factKey(x)===factKey(f)))chosen.push(f);if(chosen.length>=(state.preferences.length==="short"?1:state.preferences.length==="detailed"?4:3))break;}if(!chosen.length)return synthesizeFromFragments(userText,classification,fragments,emotion,code);const sentences=chosen.map(f=>renderFact(f,code).replace(/[.]$/,"") );let core="";if(code==="es")core=sentences.length===1?sentences[0]:sentences.length===2?`${sentences[0]}. Además, ${lowerFirst(sentences[1])}`:`${sentences[0]}. Además, ${lowerFirst(sentences[1])}. ${capitalize(sentences.slice(2).join("; "))}`;else if(code==="en")core=sentences.length===1?sentences[0]:sentences.length===2?`${sentences[0]}. In addition, ${lowerFirst(sentences[1])}`:`${sentences[0]}. In addition, ${lowerFirst(sentences[1])}. ${capitalize(sentences.slice(2).join("; "))}`;else core=sentences.join(`. ${t.besides} `);core=core.replace(/\s+/g," ").trim();if(!/[.!?。！？]$/.test(core))core+=".";const prefix=emotionLead(emotion,code)+topicEmoji(`${userText} ${topic}`)+" ",suffix=classification.intent==="explanation"?` ${t.followExplain}`:classification.intent==="definition"?` ${t.followDefine}`:"",offlineNote=opts.offline?(code==="es"?" Lo recuerdo de información que aprendí anteriormente; no estoy consultando la web ahora.":code==="en"?" I remember this from information learned earlier; I am not consulting the web now.":""):"";return `${prefix}${core}${offlineNote}${suffix}`;}
  function offlineKnowledgeAnswer(userText,classification,semantic,emotion,code=state.activeLanguage,model="flash"){const hits=recallOfflineKnowledge(userText,code,model==="thinking"?4:2);if(!hits.length)return null;const best=hits[0],pages=(best.pages||[]).map(p=>({...p,cached:true})),fragments=(best.fragments||[]).map(f=>({sentence:f.sentence,page:pages.find(p=>p.title===f.title)||{title:f.title,url:f.url,cached:true}})),reasoning=runReasoningEngine(userText,semantic,code),text=languageGenerator(userText,classification,semantic,fragments,reasoning,emotion,code,{offline:true});return{text,pages,fragments,reasoning,topic:best.topic,offline:true,score:best.score,steps:[`Offline: recuperé conocimiento aprendido con cosine similarity ${(best.cosine*100).toFixed(0)}%.`,...reasoning.steps,"No realicé ninguna consulta web."]};}

  // --------------------------- Automatic tools ---------------------------
  function isMathRequest(text){const n=normalize(text);const hasNumber=/\d/.test(n);const command=/\b(calcula|calcular|cuanto es|cuanto da|resuelve|calculate|what is|compute)\b/.test(n);const naturalOp=/\b(raiz cuadrada|sqrt|dividido|divided|multiplicado|times|elevado|potencia|plus|minus|mas|menos)\b/.test(n);const symbolic=/[+\-*/%^]/.test(String(text));return (hasNumber&&(command||naturalOp||symbolic))||/^\s*[-+]?\d[\d\s()+\-*/%^.,]*\s*$/.test(String(text));}
  function isTimeRequest(text){const n=normalize(text);return /\b(que hora es|hora actual|dime la hora|current time|what time is it|time now)\b/.test(n)||/מה השעה|كم الساعة|何時|몇 시|几点/.test(String(text));}
  function isWeatherRequest(text){const n=normalize(text);return /\b(clima|tiempo meteorologico|que tiempo hace|temperatura|weather|forecast|meteo)\b/.test(n)||/מזג האוויר|الطقس|погода|天気|날씨|天气/.test(String(text));}

  function mathNormalize(text){
    let x=String(text||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[¿?¡!]/g," ").replace(/\b(cual es|cuanto es|cuanto da|calcula|calcular|resuelve|resultado de|calculate|compute|what is)\b/g," ");
    x=x.replace(/raiz cuadrada de\s*([\d.,]+)/g,"sqrt($1)").replace(/elevado a|a la potencia de/g,"^").replace(/dividido (?:por|entre)|entre/g,"/").replace(/multiplicado por|por|×|x/g,"*").replace(/mas|más/g,"+").replace(/menos/g,"-").replace(/,/g,".");
    return x.replace(/[^0-9.+\-*/%^()sqrt\s]/g," ").replace(/\s+/g,"").trim();
  }
  function evaluateMathExpression(expr){
    const src=expr.replace(/sqrt\(([^()]+)\)/g,"($1)^0.5");const tokens=src.match(/\d+(?:\.\d+)?|[()+\-*/%^]/g)||[];let i=0;
    const peek=()=>tokens[i],take=()=>tokens[i++];
    function primary(){const t=take();if(t==="("){const v=expression();if(take()!==")")throw new Error("Paréntesis incompleto");return v;}const n=Number(t);if(!Number.isFinite(n))throw new Error("Número inválido");return n;}
    function unary(){if(peek()==="+"){take();return unary();}if(peek()==="-"){take();return-unary();}return primary();}
    function power(){let v=unary();if(peek()==="^"){take();v=Math.pow(v,power());}return v;}
    function term(){let v=power();while(["*","/","%"].includes(peek())){const op=take(),r=power();if((op==="/"||op==="%")&&r===0)throw new Error("División por cero");v=op==="*"?v*r:op==="/"?v/r:v%r;}return v;}
    function expression(){let v=term();while(["+","-"].includes(peek())){const op=take(),r=term();v=op==="+"?v+r:v-r;}return v;}
    const value=expression();if(i!==tokens.length||!Number.isFinite(value))throw new Error("Expresión inválida");return value;
  }
  function mathTool(text){const expr=mathNormalize(text);if(!expr||!/[0-9]/.test(expr))return null;try{const value=evaluateMathExpression(expr);const pretty=Number.isInteger(value)?String(value):String(Number(value.toFixed(10)));return{tool:"Math",text:`🧮 ${expr.replace(/\*/g," × ").replace(/\//g," ÷ ").replace(/\^/g," ^ ")} = ${pretty}`,steps:["Detecté una operación matemática.","La resolví con el calculador local, sin Wikipedia."],topic:"matemáticas"};}catch(e){return{tool:"Math",text:`No pude resolver esa operación: ${e.message}.`,steps:["El calculador local detectó una expresión, pero no pudo evaluarla."],topic:"matemáticas",error:true};}}
  function timeTool(code){const now=new Date();const formatted=new Intl.DateTimeFormat(code==="auto"?undefined:code,{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false,timeZoneName:"short"}).format(now);return{tool:"Clock",text:`🕒 ${formatted}`,steps:["Consulté el reloj local del dispositivo e incluí horas, minutos y segundos."],topic:"hora actual"};}
  function geolocate(){return new Promise((resolve,reject)=>{if(!navigator.geolocation)return reject(new Error("Geolocalización no disponible"));navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude}),e=>reject(new Error(e.message||"Permiso de ubicación denegado")),{enableHighAccuracy:false,timeout:8000,maximumAge:600000});});}
  function extractWeatherPlace(text){
    const raw=String(text||"").trim();const m=raw.match(/(?:\ben\b|\bin\b|\bà\b|\ba\b|\bem\b)\s+([\p{L}\p{N} .'-]{2,60})[?!.]?$/iu);if(!m)return"";
    return m[1].replace(/\b(hoy|today|ahora|now|mañana|tomorrow)\b/gi,"").trim();
  }
  async function geocodePlace(place,code){const p=new URLSearchParams({name:place,count:"1",language:(code||"en").slice(0,2),format:"json"});const r=await fetch(`https://geocoding-api.open-meteo.com/v1/search?${p}`);if(!r.ok)throw new Error("No pude buscar esa ubicación");const d=await r.json();const x=d.results?.[0];if(!x)throw new Error("No encontré esa ubicación");return{lat:x.latitude,lon:x.longitude,name:[x.name,x.admin1,x.country].filter(Boolean).join(", ")};}
  function weatherLabel(code){if(code===0)return"despejado";if([1,2].includes(code))return"parcialmente nublado";if(code===3)return"nublado";if([45,48].includes(code))return"con niebla";if([51,53,55,56,57].includes(code))return"con llovizna";if([61,63,65,66,67,80,81,82].includes(code))return"con lluvia";if([71,73,75,77,85,86].includes(code))return"con nieve";if([95,96,99].includes(code))return"con tormenta";return`código meteorológico ${code}`;}
  async function weatherTool(text,code){
    let place=extractWeatherPlace(text),loc;if(place)loc=await geocodePlace(place,code);else{const g=await geolocate();loc={...g,name:"tu ubicación"};}
    const p=new URLSearchParams({latitude:String(loc.lat),longitude:String(loc.lon),current:"temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",timezone:"auto"});
    const r=await fetch(`https://api.open-meteo.com/v1/forecast?${p}`);if(!r.ok)throw new Error("No pude consultar el clima");const d=await r.json();const c=d.current;if(!c)throw new Error("No recibí condiciones actuales");
    return{tool:"Weather",text:`🌦️ En ${loc.name}: ${c.temperature_2m} °C, sensación ${c.apparent_temperature} °C, ${weatherLabel(c.weather_code)}, humedad ${c.relative_humidity_2m}% y viento ${c.wind_speed_10m} km/h.`,steps:[place?`Resolví la ubicación “${place}”.`:"Usé la ubicación compartida por el navegador.","Consulté condiciones meteorológicas actuales con Open-Meteo."],topic:`clima ${loc.name}`,sources:[{title:"Open-Meteo",provider:"Open-Meteo",url:"https://open-meteo.com/"}]};
  }
  async function routeAutomaticTool(text,code){if(isMathRequest(text))return mathTool(text);if(isTimeRequest(text))return timeTool(code);if(isWeatherRequest(text)){if(!isOnline())return{tool:"Weather",text:code==="es"?"🌦️ Estoy offline. El clima es información actual y requiere conexión, así que no voy a reutilizar un dato antiguo como si fuera actual.":"🌦️ I am offline. Weather is current information and requires a connection, so I will not reuse an old value as if it were current.",steps:["Bloqueé una función online mientras no hay conexión para evitar datos desactualizados o inventados."],topic:"clima",error:true,offline:true};try{return await weatherTool(text,code);}catch(e){return{tool:"Weather",text:`No pude obtener el clima automáticamente: ${e.message}. Puedes indicar una ciudad, por ejemplo “clima en Madrid”.`,steps:["Detecté una consulta meteorológica, pero faltó una ubicación utilizable o permiso del navegador."],topic:"clima",error:true};}}return null;}

  function decideResponseStrategy(text) {
    const n=normalize(text),raw=String(text).toLowerCase();
    const comparePatterns=[/\bvs\b/,/\bversus\b/,/\bcompar/,/\bdiferenc/,/\bsimilit/,/\bdifference/,/\bcompare/,/\bvergleich/,/\bunterschied/,/\bdiff[eé]rence/,/\bconfronta/,/\bdiferen[cç]a/,/сравни|разниц/,/השווה|הבדל/,/قارن|الفرق/,/比較|違い/,/비교|차이/,/比较|区别/];
    return comparePatterns.some(re=>re.test(n)||re.test(raw))?"compare":"combine";
  }

  function extractComparisonSubjects(text) {
    const n = normalize(text)
      .replace(/^(compara|comparame|comparar)\s+/, "")
      .replace(/^cual(?:es)? (?:es|son) (?:la |las )?diferencia(?:s)? entre\s+/, "")
      .replace(/^diferencia(?:s)? entre\s+/, "")
      .replace(/^similitudes? entre\s+/, "");
    const separators = [/\s+vs\s+/, /\s+versus\s+/, /\s+frente a\s+/, /\s+y\s+/];
    for (const re of separators) {
      const parts = n.split(re).map(x => x.trim()).filter(Boolean);
      if (parts.length >= 2) return parts.slice(0,2).map(x => x.replace(/^(el|la|los|las|un|una)\s+/, "").trim());
    }
    const tokens = contentTokens(text);
    if (tokens.length >= 2) return [tokens[0], tokens[1]];
    return [];
  }

  function emotionLead(emotion, code=state.activeLanguage) {
    const t=lang(code);return t[emotion?.tone]||t.neutral;
  }

  async function wikiSearch(query, limit=5, code=state.activeLanguage) {
    if(!isOnline())throw new Error("OFFLINE_WEB_BLOCKED");
    const wiki=lang(code).wiki;
    const p=new URLSearchParams({action:"query",list:"search",srsearch:query,srlimit:String(limit),srprop:"snippet|wordcount",format:"json",origin:"*"});
    const r=await fetch(`https://${wiki}.wikipedia.org/w/api.php?${p}`);if(!r.ok)throw new Error(`Wikipedia ${r.status}`);const d=await r.json();
    return(d.query?.search||[]).map(x=>({title:x.title,pageid:x.pageid,snippet:stripHtml(x.snippet||""),lang:code}));
  }

  async function wikiExtract(titles, sentences=9, code=state.activeLanguage) {
    if(!titles.length)return[];if(!isOnline())throw new Error("OFFLINE_WEB_BLOCKED");const wiki=lang(code).wiki;
    const p=new URLSearchParams({action:"query",prop:"extracts|info",exintro:"1",explaintext:"1",exsentences:String(sentences),inprop:"url",redirects:"1",titles:titles.join("|"),format:"json",origin:"*"});
    const r=await fetch(`https://${wiki}.wikipedia.org/w/api.php?${p}`);if(!r.ok)throw new Error(`Wikipedia ${r.status}`);const d=await r.json();
    return Object.values(d.query?.pages||{}).filter(x=>!x.missing).map(x=>({title:x.title,extract:(x.extract||"").trim(),url:x.fullurl||"",lang:code}));
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
  function synthesizeFromFragments(userText, classification, fragments, emotion, code=state.activeLanguage) {
    const t=lang(code);
    if(!fragments.length) return `${t.neutral}${t.unavailable}`;
    const topic=bestTopicFromQuery(userText, fragments.map(f=>f.page.title));
    const emoji=topicEmoji(`${userText} ${topic}`);
    const parts=fragments.map(f=>cleanSentenceForSynthesis(f.sentence));
    const clauses=[];
    const clauseLimit=state.preferences.length==="short"?1:(state.preferences.length==="detailed"?4:3);
    for(const part of parts){const first=part.split(/[;:]/)[0].trim();if(first.length>18&&first.length<300&&!clauses.some(c=>normalize(c)===normalize(first)))clauses.push(first);if(clauses.length>=clauseLimit)break;}
    let core="";
    if(clauses.length===1) core=clauses[0];
    else if(clauses.length===2) core=`${clauses[0].replace(/[.]$/,'')}; ${t.besides}, ${lowerFirst(clauses[1])}`;
    else if(clauses.length===3) core=`${clauses[0].replace(/[.]$/,'')}; ${lowerFirst(clauses[1]).replace(/[.]$/,'')}, ${t.and} ${lowerFirst(clauses[2])}`;
    else core=`${clauses[0].replace(/[.]$/,'')}; ${lowerFirst(clauses[1]).replace(/[.]$/,'')}; ${lowerFirst(clauses[2]).replace(/[.]$/,'')}, ${t.and} ${lowerFirst(clauses[3])}`;
    core=core.replace(/\s+/g," ").trim();if(!/[.!?。！？]$/.test(core))core+=".";
    const lead=emotionLead(emotion,code);
    if(classification.intent==="explanation")return `${lead}${emoji} ${core} ${t.followExplain}`;
    if(classification.intent==="definition")return `${lead}${emoji} ${core} ${t.followDefine}`;
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

  async function conceptKnowledge(userText, classification, model, code=state.activeLanguage) {
    const semantic=semanticEngine2(userText,code);if(!isOnline()){const cached=offlineKnowledgeAnswer(userText,classification,semantic,state.emotion,code,model);if(cached)return{...cached,tokens:contentTokens(userText,code),groups:conceptGroups(userText,code)};throw new Error("OFFLINE_NO_LEARNED_KNOWLEDGE");}
    const tokens=contentTokens(userText,code);const groups=conceptGroups(userText,code);const remembered=inferRememberedTopic(userText);
    const semanticHits=recallSemanticMemory(userText,3);const graphHits=graphRelated(tokens,model==="thinking"?4:2);
    let queryParts=[...groups.filter(g=>g.includes(" ")),...tokens,...semanticHits.map(x=>x.subject),...graphHits].slice(0,model==="thinking"?7:4);
    if(["ja","zh","ko"].includes(code)&&queryParts.length<2)queryParts=[String(userText).trim()];
    if(remembered&&tokens.length<2)queryParts.unshift(remembered);
    const uniqueQueries=[...new Set(queryParts.filter(Boolean))];const steps=[];
    steps.push(`Idioma: ${lang(code).name}. Tokenización: ${tokenizeAll(userText).length} unidades; ${tokens.length} conceptos principales.`);
    if(groups.length)steps.push(`Conceptos agrupados: ${groups.slice(0,4).join(" · ")}.`);
    if(semanticHits.length)steps.push(`Memoria semántica recuperada: ${semanticHits.map(x=>x.subject).join(" · ")}.`);
    if(graphHits.length)steps.push(`Grafo de conceptos expandió: ${graphHits.join(" · ")}.`);
    const searchLimit=model==="thinking"?4:3;const allSearch=[];
    const maxQueries=model==="thinking"?4:2;
    const jobs=uniqueQueries.slice(0,maxQueries).map(q=>wikiSearch(q,searchLimit,code).catch(()=>[]));
    const batches=await Promise.all(jobs);batches.flat().forEach(x=>allSearch.push(x));
    const dedup=[...new Map(allSearch.map(x=>[x.title,x])).values()].slice(0,model==="thinking"?7:4);if(!dedup.length)throw new Error("Sin resultados de Wikipedia");
    steps.push(`Fuentes candidatas encontradas: ${dedup.length}.`);
    const pages=await wikiExtract(dedup.map(x=>x.title),model==="thinking"?10:7,code);const prefMax=state.preferences.length==="short"?1:(state.preferences.length==="detailed"?(model==="thinking"?5:4):(model==="thinking"?4:2));const fragments=selectConceptFragments(pages,userText,prefMax);
    steps.push(`Fragmentos relevantes seleccionados: ${fragments.length}.`);if(model==="thinking")steps.push(`Cobertura cruzada: ${fragments.map(f=>f.page.title).filter((x,i,a)=>a.indexOf(x)===i).join(" · ")}.`);
    const topic=bestTopicFromQuery(userText,pages.map(p=>p.title));learnKnowledgeForOffline(userText,topic,pages,fragments,code);const reasoning=runReasoningEngine(userText,semantic,code);steps.push("Guardé una versión compacta de lo aprendido para poder recuperarla offline.",...reasoning.steps);
    return{pages,fragments,steps,tokens,groups,topic,reasoning,offline:false};
  }

  async function comparisonKnowledge(userText, model, code=state.activeLanguage) {
    const subjects = extractComparisonSubjects(userText);
    if (subjects.length < 2) return null;
    const steps = [`Detecté una pregunta comparativa y separé los conceptos: ${subjects[0]} ↔ ${subjects[1]}.`];
    const results = [];
    for (const subject of subjects) {
      if(!isOnline()){const semantic=semanticEngine2(subject,code);const cached=offlineKnowledgeAnswer(subject,{intent:"definition"},semantic,state.emotion,code,model);if(cached)results.push({subject,pages:cached.pages,fragments:cached.fragments,topic:cached.topic,offline:true});continue;}
      const search = await wikiSearch(subject, model === "thinking" ? 4 : 3, code);
      if (!search.length) continue;
      const pages = await wikiExtract(search.slice(0, model === "thinking" ? 3 : 2).map(x => x.title), model === "thinking" ? 9 : 6, code);
      const fragments = selectConceptFragments(pages, subject, model === "thinking" ? 2 : 1);
      const topic=bestTopicFromQuery(subject, pages.map(p => p.title));learnKnowledgeForOffline(subject,topic,pages,fragments,code);
      results.push({ subject, pages, fragments, topic });
    }
    if (results.length < 2) return null;
    steps.push("Busqué cada concepto por separado para evitar mezclar sus características.");
    steps.push("Seleccioné la información más representativa de cada lado y la puse en contraste.");
    if (model === "thinking") steps.push("Contrasté similitudes y diferencias usando fuentes separadas antes de redactar la comparación.");
    return { subjects, results, steps };
  }

  function synthesizeComparison(userText, comparison, emotion, code=state.activeLanguage) {
    const t=lang(code);const[a,b]=comparison.results;
    const aText=cleanSentenceForSynthesis(a.fragments[0]?.sentence||a.pages[0]?.extract||t.unavailable);const bText=cleanSentenceForSynthesis(b.fragments[0]?.sentence||b.pages[0]?.extract||t.unavailable);
    const aShort=aText.split(/(?<=[.!?。！？])\s+/)[0].slice(0,300);const bShort=bText.split(/(?<=[.!?。！？])\s+/)[0].slice(0,300);
    const aTokens=new Set(contentTokens(aText,code)),bTokens=new Set(contentTokens(bText,code));const shared=[...aTokens].filter(x=>bTokens.has(x)).slice(0,4);
    const similarity=shared.length?` ${t.shared} ${shared.join(", ")}.`:"";
    return `${emotionLead(emotion,code)}⚖️ ${capitalize(a.topic||a.subject)}: ${aShort} ${t.contrast}, ${b.topic||b.subject}: ${lowerFirst(bShort)}${similarity}`;
  }

  function capitalize(s){return s?s[0].toUpperCase()+s.slice(1):s;}

  function localConversation(text, classification, emotion, code=state.activeLanguage) {
    const n=normalize(text),raw=String(text).toLowerCase(),t=lang(code);
    if(classification.intent==="greeting")return t.greeting;
    if(classification.intent==="wellbeing")return t.wellbeing;
    const thanks=/\b(gracias|thanks|thank you|merci|danke|grazie|obrigad|спасибо)\b/.test(n)||/תודה|شكرا|ありがとう|고마워|谢谢/.test(raw);if(thanks)return t.thanks;
    const identity=/\b(quien eres|what are you|who are you|qui es tu|wer bist du|chi sei|quem e voce|кто ты)\b/.test(n)||/מי אתה|من أنت|あなたは誰|누구야|你是谁/.test(raw);if(identity)return t.identity;
    if(classification.intent==="conversation"&&contentTokens(text,code).length<2&&!isMathRequest(text)&&!isTimeRequest(text)&&!isWeatherRequest(text))return `${emotionLead(emotion,code)}${t.listen}`;
    return null;
  }

  async function answerTextCore(text, modelOverride=state.model) {
    const code=resolveLanguage(text);const emotion=detectEmotion(text);state.emotion=emotion;updateEmotionUI();
    const preferenceChanges=inferPreferences(text);const correction=learnCorrection(text);
    const semantic=semanticEngine2(text,code);const resolution=resolveCoreferences(text,semantic);const effectiveText=resolution.text;
    const classification=classifyIntent(effectiveText,code);const strategy=decideResponseStrategy(effectiveText);state.responseStrategy=strategy;
    const uncertainty=assessUncertainty(text,semantic,classification,resolution);
    observeSemanticInput(text,semantic);

    if(correction?.needsDetail){
      return{text:applyPreferences("Entiendo que quieres corregirme, pero necesito que me digas cuál es la información correcta para poder aprenderla."),classification,emotion,steps:["Detecté una corrección, pero no contiene todavía el dato corregido."],sources:[],tokens:tokenizeAll(text),topic:state.lastTopic||"",strategy,language:code,semantic,uncertainty,tool:"Correction Learning"};
    }
    if(correction?.learned){
      return{text:applyPreferences(`Entendido. Aprendí esta corrección para preguntas parecidas: “${correction.record.correction}”.`),classification,emotion,steps:["Vinculé la corrección con la pregunta anterior.","La guardé en memoria semántica local con alta prioridad."],sources:[],tokens:tokenizeAll(text),topic:correction.record.topic||"",strategy,language:code,semantic,uncertainty,tool:"Correction Learning"};
    }
    if(preferenceChanges.length&&classification.intent==="conversation"&&semantic.concepts.length<=5){
      return{text:applyPreferences(`Perfecto. Adapté mis respuestas a tu preferencia: ${preferenceChanges.join(", ")}.`),classification,emotion,steps:["Detecté una preferencia explícita del usuario.","La guardé localmente para respuestas futuras."],sources:[],tokens:tokenizeAll(text),topic:"preferencias",strategy,language:code,semantic,uncertainty,tool:"Preference Memory"};
    }

    const local=localConversation(text,classification,emotion,code);
    if(local)return{text:applyPreferences(local),classification,emotion,steps:[],sources:[],tokens:tokenizeAll(text),topic:"",strategy,language:code,semantic,uncertainty};

    const tool=await routeAutomaticTool(effectiveText,code);
    const plan=modelOverride==="thinking"?buildResponsePlan(effectiveText,semantic,classification,strategy,tool?.tool||""):[];
    state.lastPlan=plan;
    if(tool){
      const out={...tool,text:applyPreferences(tool.text),classification,emotion,steps:[...plan,...(tool.steps||[])],tokens:tokenizeAll(text),strategy,language:code,semantic,uncertainty};
      if(tool.topic){state.lastTopic=tool.topic;rememberSemantic({type:"tool_result",subject:tool.topic,predicate:"answered_with",object:tool.tool,confidence:.85});}
      return out;
    }

    if(!isOnline()&&requiresFreshOnlineData(effectiveText)){
      return{text:applyPreferences(code==="es"?"Estoy offline y esa pregunta necesita información actual. Aunque tenga recuerdos anteriores, no los voy a presentar como si fueran datos vigentes.":"I am offline and that question requires current information. Even if I have older memories, I will not present them as current data."),classification,emotion,steps:[...plan,"Detecté que la consulta requiere datos frescos y bloqueé la memoria offline para evitar información desactualizada."],sources:[],tokens:tokenizeAll(text),topic:resolution.resolvedTopic||"",strategy,language:code,semantic,uncertainty,offline:true,error:true};
    }

    if(uncertainty.needsClarification){
      return{text:applyPreferences(`${emotionLead(emotion,code)}${uncertainty.question}`),classification,emotion,steps:[...plan,`Incertidumbre alta (${Math.round(uncertainty.score*100)}%): ${uncertainty.reasons.join(", ")||"contexto insuficiente"}.`],sources:[],tokens:tokenizeAll(text),topic:resolution.resolvedTopic||"",strategy,language:code,semantic,uncertainty};
    }

    const learned=recallCorrection(effectiveText);
    if(learned){
      state.lastTopic=learned.topic||state.lastTopic;
      return{text:applyPreferences(`${emotionLead(emotion,code)}🧠 ${learned.correction}`),classification,emotion,steps:[...plan,"Encontré una corrección aprendida relevante y la prioricé sobre una nueva búsqueda."],sources:[],tokens:tokenizeAll(text),topic:learned.topic||"",strategy,language:code,semantic,uncertainty,correctionScore:learned.score};
    }

    try{
      const knowledgeModel=modelOverride==="live"?"flash":modelOverride;
      if(strategy==="compare"){
        const comparison=await comparisonKnowledge(effectiveText,knowledgeModel,code);
        if(comparison){
          const response=applyPreferences(synthesizeComparison(effectiveText,comparison,emotion,code));const sources=[...new Map(comparison.results.flatMap(r=>r.pages).map(p=>[p.title,p])).values()];const topic=comparison.results.map(r=>r.topic||r.subject).join(" vs ");state.lastTopic=topic;updateConceptGraph(contentTokens(effectiveText,code),topic);rememberSemantic({type:"knowledge",subject:topic,predicate:"compared",object:comparison.subjects.join(" vs "),confidence:.82});
          return{text:response,classification,emotion,steps:[...plan,"Estrategia: comparar.",...comparison.steps],sources,tokens:tokenizeAll(text),topic,strategy,language:code,semantic,uncertainty};
        }
      }
      const knowledge=await conceptKnowledge(effectiveText,classification,knowledgeModel,code);state.lastTopic=knowledge.topic;updateConceptGraph([...knowledge.tokens,...knowledge.groups],knowledge.topic);rememberSemantic({type:"knowledge",subject:knowledge.topic,predicate:"explained",object:knowledge.fragments.map(f=>f.sentence).join(" ").slice(0,300),keywords:knowledge.tokens,confidence:.8});
      const reasoning=knowledge.reasoning||runReasoningEngine(effectiveText,semantic,code);const response=applyPreferences(languageGenerator(effectiveText,classification,semantic,knowledge.fragments,reasoning,emotion,code,{offline:Boolean(knowledge.offline)}));const sources=[...new Map(knowledge.fragments.map(f=>[f.page.title,f.page])).values()];
      return{text:response,classification,emotion,steps:[...plan,`Estrategia: ${strategy==="compare"?"comparación incompleta → síntesis":"combinar"}.`,"Language Generator 1.0 construyó la respuesta desde hechos y relaciones.",...knowledge.steps],sources,tokens:tokenizeAll(text),topic:knowledge.topic,groups:knowledge.groups,strategy,language:code,semantic,uncertainty,offline:Boolean(knowledge.offline),cosine:knowledge.score||0,reasoning};
    }catch(e){console.warn(e);const t=lang(code),networkFailure=!isOnline()||String(e?.message||"").includes("OFFLINE")||/fetch|network|failed/i.test(String(e?.message||""));if(networkFailure&&!requiresFreshOnlineData(effectiveText)){const cached=offlineKnowledgeAnswer(effectiveText,classification,semantic,emotion,code,knowledgeModel);if(cached){state.lastTopic=cached.topic||state.lastTopic;const sources=[...new Map(cached.fragments.map(f=>[f.page.title,f.page])).values()];return{text:applyPreferences(cached.text),classification,emotion,steps:[...plan,"La consulta web falló; cambié al conocimiento aprendido local.",...cached.steps],sources,tokens:tokenizeAll(text),topic:cached.topic||"",strategy,language:code,offline:true,cosine:cached.score||0,reasoning:cached.reasoning,semantic,uncertainty};}}const offline=networkFailure,msg=offline?(code==="es"?"Estoy offline y todavía no tengo conocimiento aprendido con suficiente similitud para responder eso con seguridad. Prefiero no inventarlo.":"I am offline and I do not yet have learned knowledge similar enough to answer that safely. I prefer not to invent it."):`${emotionLead(emotion,code)}${t.unavailable}`;return{text:applyPreferences(msg),classification,emotion,steps:[...plan,offline?"Offline: no encontré memoria aprendida por encima del umbral de cosine similarity; no generé una respuesta factual.":"La consulta externa no terminó con datos utilizables."],sources:[],tokens:tokenizeAll(text),topic:"",strategy,language:code,error:true,offline,semantic,uncertainty};}
  }

  function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
  function processingComplexity(text){const tokens=tokenizeAll(text).length;let score=tokens/4;if(decideResponseStrategy(text)==="compare")score+=2;if(/[?¿]/.test(text))score+=1;if(state.lastTopic)score+=.5;if(recallSemanticMemory(text,2).length)score+=.5;if(/(por que|explica|analiza|relaciona|why|explain|analyze)/.test(normalize(text)))score+=1;return score;}
  function timedFallback(text,model,code){const t=lang(code),emotion=detectEmotion(text),classification=classifyIntent(text,code);return{text:`${emotionLead(emotion,code)}${t.unavailable}`,classification,emotion,steps:[`${model} alcanzó su límite de procesamiento y devolvió el respaldo local.`],sources:[],tokens:tokenizeAll(text),topic:"",strategy:decideResponseStrategy(text),language:code,timedOut:true};}
  function updateProcessingStatus(label){const meta=$("#typing .message-meta");if(meta)meta.textContent=`Logic AI · ${label}`;}
  function thinkingPassLabel(i,total){const labels=["Semantic Engine 2.0: intención, entidades y relaciones","resolviendo coreference e incertidumbre","recuperando memoria semántica y correcciones","construyendo planner de respuesta","seleccionando herramienta o fuentes","expandiendo el grafo de conceptos","comparando cobertura de evidencia","seleccionando fragmentos compatibles","sintetizando según preferencias","revisión final de coherencia"];return `Thinking ${i}/${total} · ${labels[Math.min(i-1,labels.length-1)]}`;}

  async function answerText(text){
    const code=resolveLanguage(text);const chosen=state.model==="live"?"flash":state.model;
    if(chosen==="thinking"){
      const passes=Math.max(2,Math.min(10,2+Math.ceil(processingComplexity(text))));const totalMs=passes*2000;const started=performance.now();let settled=false,result=null;
      answerTextCore(text,"thinking").then(r=>{settled=true;result=r;}).catch(()=>{});
      const passSteps=[];for(let i=1;i<=passes;i++){const label=thinkingPassLabel(i,passes);updateProcessingStatus(label);passSteps.push(label.replace(/^Thinking \d+\/\d+ · /,""));await sleep(2000);}
      if(!settled)result=timedFallback(text,"Thinking 1.1",code);result.steps=[`Thinking ejecutó ${passes} pasadas de aproximadamente 2 s.`,...passSteps,...(result.steps||[])];result.processingMs=Math.round(performance.now()-started);result.passes=passes;return result;
    }
    const targetMs=Math.max(1000,Math.min(3000,1000+Math.round(processingComplexity(text)*260)));const started=performance.now();let timer;
    const timeout=new Promise(resolve=>{timer=setTimeout(()=>resolve(timedFallback(text,"Flash 1.1",code)),3000);});
    const result=await Promise.race([answerTextCore(text,"flash"),timeout]);clearTimeout(timer);const elapsed=performance.now()-started;if(elapsed<targetMs)await sleep(targetMs-elapsed);result.processingMs=Math.round(performance.now()-started);return result;
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
    return best.topic||bestSemanticTopic(text);
  }
  function relatedSuggestions(topic,code=state.activeLanguage){if(!topic||code!=="es")return[];return [`¿Cómo funciona ${topic}?`,`¿Qué datos curiosos hay sobre ${topic}?`,`¿Con qué se relaciona ${topic}?`];}

  // --------------------------- Rendering ---------------------------
  function welcomeHtml(){return `<div class="message ai"><div class="avatar">L</div><div class="bubble"><div class="message-meta">Logic AI · ${MODEL_META[state.model].title}</div><p>¡Hola! 👋 Ahora uso Semantic Engine 2.0, cosine similarity, memoria offline aprendida, Reasoning Engine y Language Generator propio. Puedo aprender online y reutilizar ese conocimiento sin conexión sin inventar datos actuales.</p><div class="chips"><button class="chip" data-prompt="¿Cuánto es (125 + 37) * 4?">🧮 Cálculo automático</button><button class="chip" data-prompt="¿Qué hora es?">🕒 Reloj</button><button class="chip" data-prompt="Explícame Saturno y después te preguntaré por sus lunas.">🧠 Memoria + coreference</button></div></div></div>`;}
  function renderActiveChat(){const c=ensureChat();els.chatWrap.innerHTML="";const last=[...(c.messages||[])].reverse().find(m=>m.topic);state.lastTopic=last?.topic||"";if(!c.messages.length){els.chatWrap.innerHTML=welcomeHtml();return;}for(const m of c.messages){if(m.role==="user")renderUser(m.text,false);else renderStoredAI(m);}scrollBottom();}
  function renderUser(text,save=true){const w=document.createElement("div");w.className="message user";w.innerHTML=`<div class="bubble"><div class="message-meta">Tú</div><p dir="auto">${escapeHtml(text)}</p></div><div class="avatar">T</div>`;els.chatWrap.appendChild(w);if(save)saveMessage("user",text);scrollBottom();}
  function renderStoredAI(m){renderAI({...m,classification:m.classification||{intent:"conversation",confidence:0,engine:"memoria"}},false);}
  function renderAI(result,save=true){
    const w=document.createElement("div");w.className="message ai";const bubble=document.createElement("div");bubble.className="bubble";
    bubble.innerHTML=`<div class="message-meta">Logic AI · ${(MODEL_META[result.model||state.model]||MODEL_META.flash).title}</div><p dir="auto">${escapeHtml(result.text)}</p>`;
    if(result.sources?.length){result.sources.slice(0,4).forEach(s=>{const a=document.createElement("a");a.className="source-link";a.href=s.url;a.target="_blank";a.rel="noopener noreferrer";a.textContent=`Fuente: ${s.provider||"Wikipedia"} · ${s.title} ↗`;bubble.appendChild(a);bubble.appendChild(document.createElement("br"));});}
    if(state.model==="thinking" && result.steps?.length){const d=document.createElement("div");d.className="thought-panel";d.innerHTML=`<strong>Pasos de análisis visibles</strong><ol>${result.steps.map(s=>`<li>${escapeHtml(s)}</li>`).join("")}</ol>`;bubble.appendChild(d);}
    if(els.analysisToggle.checked && result.tokens){const a=document.createElement("div");a.className="analysis-box";a.innerHTML=`<strong>Intención:</strong> ${escapeHtml(result.classification?.intent||"—")} · <strong>Estrategia:</strong> ${escapeHtml(result.strategy==="compare"?"comparar":"combinar")} · <strong>Motor:</strong> ${escapeHtml(result.classification?.engine||"—")} · <strong>Emoción:</strong> ${escapeHtml(result.emotion?.name||"Neutral")} · <strong>Idioma:</strong> ${escapeHtml(LANGUAGES[result.language||state.activeLanguage]?.name||"—")}${result.tool?` · <strong>Herramienta:</strong> ${escapeHtml(result.tool)}`:""}${result.semantic?` · <strong>Semantic:</strong> ${escapeHtml(result.semantic.action)} (${Math.round((result.semantic.confidence||0)*100)}%)`:""}${result.uncertainty?` · <strong>Incertidumbre:</strong> ${Math.round((result.uncertainty.score||0)*100)}%`:""}${result.processingMs?` · <strong>Proceso:</strong> ${(result.processingMs/1000).toFixed(1)} s${result.passes?` · ${result.passes} pasadas`:""}`:""}${result.offline?` · <strong>Offline:</strong> memoria aprendida`:""}${result.cosine?` · <strong>Cosine:</strong> ${Math.round(result.cosine*100)}%`:""}${result.reasoning?` · <strong>Reasoning:</strong> ${result.reasoning.inferred?.length||0} inferencias`:""}<div class="token-line">${result.tokens.slice(0,24).map(t=>`<span class="token">${escapeHtml(t)}</span>`).join("")}</div>`;bubble.appendChild(a);}
    const sug=relatedSuggestions(result.topic,result.language||state.activeLanguage).slice(0,3);if(sug.length){const box=document.createElement("div");box.className="suggestion-box";box.innerHTML=`<div class="suggestion-title">Temas relacionados</div><div class="chips">${sug.map(s=>`<button class="chip" data-prompt="${escapeAttr(s)}">${escapeHtml(s)}</button>`).join("")}</div>`;bubble.appendChild(box);}
    const av=document.createElement("div");av.className="avatar";av.textContent="L";w.append(av,bubble);els.chatWrap.appendChild(w);scrollBottom();
    if(save) saveMessage("ai",result.text,{model:state.model,topic:result.topic||"",steps:result.steps||[],sources:result.sources||[],tokens:result.tokens||[],emotion:result.emotion||state.emotion,classification:result.classification||{},strategy:result.strategy||"combine",language:result.language||state.activeLanguage,processingMs:result.processingMs||0,passes:result.passes||0,tool:result.tool||"",semantic:result.semantic||null,uncertainty:result.uncertainty||null});
  }
  function addTyping(){const w=document.createElement("div");w.className="message ai";w.id="typing";w.innerHTML=`<div class="avatar">L</div><div class="bubble"><div class="message-meta">Logic AI · procesando</div><div class="typing"><i></i><i></i><i></i></div></div>`;els.chatWrap.appendChild(w);scrollBottom();}
  function scrollBottom(){requestAnimationFrame(()=>els.chatWrap.scrollTop=els.chatWrap.scrollHeight);}

  async function sendMessage(textOverride){
    const text=String(textOverride??els.userInput.value).trim();if(!text||state.isBusy||["media","art","live"].includes(state.model))return;
    state.isBusy=true;els.sendBtn.disabled=true;renderUser(text,true);els.userInput.value="";autoGrow();updateCharCount();addTyping();
    const result=await answerText(text);$("#typing")?.remove();renderAI(result,true);if(els.ttsToggle.checked)speak(result.text);state.isBusy=false;els.sendBtn.disabled=false;els.userInput.focus();
  }

  // --------------------------- Models/UI ---------------------------
  function setModel(model){
    if(!MODEL_META[model])model="flash";
    if(state.model==="live"&&model!=="live")stopLiveMode();
    state.model=model;localStorage.setItem("logic-ai-model",model);$$(".model-btn").forEach(b=>b.classList.toggle("active",b.dataset.model===model));
    const meta=MODEL_META[model]||MODEL_META.flash;els.modelTitle.textContent=meta.title;els.modelEyebrow.textContent=meta.eyebrow;els.composerHint.textContent=meta.hint;
    const special=["media","art","live"].includes(model);
    els.chatWrap.classList.toggle("hidden",special);els.mediaPanel.classList.toggle("hidden",model!=="media");els.artPanel.classList.toggle("hidden",model!=="art");els.livePanel.classList.toggle("hidden",model!=="live");els.trainingPanel.classList.add("hidden");
    els.composer.classList.toggle("hidden",special);els.userInput.placeholder="Escribe un mensaje…";els.sendBtn.disabled=false;
    if(!special)renderActiveChat();if(model==="live")prepareLiveMode();if(model==="art")els.artPrompt?.focus();
  }
  function updateEmotionUI(){els.emotionPill.textContent=`${state.emotion.emoji} ${state.emotion.name}`;}

  // --------------------------- TTS ---------------------------
  function loadVoices(){if("speechSynthesis" in window)state.voices=speechSynthesis.getVoices();}
  function speak(text,onEnd){if(!("speechSynthesis" in window)||!text){onEnd?.();return;}speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);const speech=speechLanguage();u.lang=speech;u.rate=1;u.pitch=1;const prefix=speech.toLowerCase().split("-")[0];u.voice=state.voices.find(v=>v.lang?.toLowerCase()===speech.toLowerCase())||state.voices.find(v=>v.lang?.toLowerCase().startsWith(prefix))||null;u.onend=()=>onEnd?.();u.onerror=()=>onEnd?.();speechSynthesis.speak(u);}

  // --------------------------- Live 1.0 ---------------------------
  function speechRecognitionCtor(){return window.SpeechRecognition||window.webkitSpeechRecognition||null;}
  function setOrbState(mode){if(!els.voiceOrb)return;els.voiceOrb.className=`voice-orb ${mode}`;}
  function prepareLiveMode(){
    const Ctor=speechRecognitionCtor();
    if(!Ctor){els.liveSupport.textContent="Este navegador no ofrece SpeechRecognition/Web Speech API. TextToSpeech sí puede seguir funcionando, pero Live necesita reconocimiento de voz compatible.";els.liveStartBtn.disabled=true;setOrbState("idle");return;}
    els.liveSupport.textContent="Reconocimiento disponible. El audio se procesa según la implementación de reconocimiento de voz de tu navegador.";els.liveStartBtn.disabled=false;
    if(!state.liveRecognition){
      const r=new Ctor();r.lang=speechLanguage();r.interimResults=true;r.continuous=false;
      r.onstart=()=>{if(state.liveActive){setOrbState("listening");els.liveStatus.textContent="Escuchando…";}};
      r.onresult=async e=>{
        let interim="",finalText="";
        for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0]?.transcript||"";if(e.results[i].isFinal)finalText+=t;else interim+=t;}
        if(interim)els.liveTranscript.textContent=interim;
        if(finalText.trim())await handleLiveUtterance(finalText.trim());
      };
      r.onerror=e=>{if(e.error!=="aborted"&&e.error!=="no-speech"){els.liveStatus.textContent=`Error de voz: ${e.error}`;setOrbState("idle");}};
      r.onend=()=>{if(state.liveActive&&!state.liveProcessing&&state.model==="live")setTimeout(startListeningCycle,250);};
      state.liveRecognition=r;
    }
  }
  function startListeningCycle(){if(!state.liveActive||state.liveProcessing||state.model!=="live")return;try{if(state.liveRecognition)state.liveRecognition.lang=speechLanguage();state.liveRecognition?.start();}catch{}}
  function startLiveMode(){prepareLiveMode();if(!state.liveRecognition)return;state.liveActive=true;state.liveProcessing=false;els.liveStartBtn.textContent="🎙️ Live activo";startListeningCycle();}
  function stopLiveMode(){state.liveActive=false;state.liveProcessing=false;try{state.liveRecognition?.abort();}catch{};speechSynthesis?.cancel?.();if(els.liveStartBtn)els.liveStartBtn.textContent="🎙️ Iniciar Live";if(els.liveStatus)els.liveStatus.textContent="Live detenido";setOrbState("idle");}
  async function handleLiveUtterance(text){
    state.liveProcessing=true;try{state.liveRecognition?.stop();}catch{};
    setOrbState("thinking");els.liveStatus.textContent="Pensando…";els.liveTranscript.innerHTML=`<strong>Tú:</strong> ${escapeHtml(text)}`;saveMessage("user",text,{model:"live"});
    const result=await answerText(text);saveMessage("ai",result.text,{model:"live",topic:result.topic||"",steps:result.steps||[],sources:result.sources||[],tokens:result.tokens||[],emotion:result.emotion||state.emotion,classification:result.classification||{},strategy:result.strategy||"combine"});
    els.liveTranscript.innerHTML=`<strong>Tú:</strong> ${escapeHtml(text)}<br><br><strong>Logic:</strong> ${escapeHtml(result.text)}`;
    setOrbState("speaking");els.liveStatus.textContent="Hablando…";
    speak(result.text,()=>{state.liveProcessing=false;if(state.liveActive&&state.model==="live"){els.liveStatus.textContent="Escuchando…";setOrbState("listening");setTimeout(startListeningCycle,250);}else setOrbState("idle");});
  }

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

  const OCR_LANG={es:"spa",en:"eng",he:"heb",fr:"fra",de:"deu",it:"ita",pt:"por",ru:"rus",ar:"ara",ja:"jpn",ko:"kor",zh:"chi_sim"};

  async function runOCR(source, label="Leyendo texto…") {
    if(!window.Tesseract) return "";
    try {
      state.tesseractBusy=true;
      const code=state.language!=="auto"?state.language:state.activeLanguage;const ocrCode=OCR_LANG[code]||"eng";const languages=ocrCode==="eng"?"eng":`${ocrCode}+eng`;const result=await Tesseract.recognize(source,languages,{logger:m=>{if(m.status==="recognizing text")setMediaProgress(15+m.progress*45,`${label} ${Math.round(m.progress*100)}%`);}});
      return (result.data?.text||"").replace(/\s+/g," ").trim();
    } catch(e){console.warn("OCR",e);return "";} finally {state.tesseractBusy=false;}
  }

  async function commonsSearchImages(query,limit=8){
    const p=new URLSearchParams({action:"query",generator:"search",gsrsearch:query,gsrnamespace:"6",gsrlimit:String(limit),prop:"imageinfo|info",iiprop:"url|extmetadata",iiurlwidth:"320",inprop:"url",format:"json",origin:"*"});
    const r=await fetch(`https://commons.wikimedia.org/w/api.php?${p}`);if(!r.ok)throw new Error(`Commons ${r.status}`);const d=await r.json();
    return Object.values(d.query?.pages||{}).map(p=>{const ii=p.imageinfo?.[0]||{};const meta=ii.extmetadata||{};return{title:(p.title||"").replace(/^File:/,""),thumb:ii.thumburl||ii.url,url:p.fullurl||ii.descriptionurl||"",description:stripHtml(meta.ImageDescription?.value||meta.ObjectName?.value||"")};}).filter(x=>x.thumb);
  }

  function loadRemoteImage(url){return new Promise((resolve,reject)=>{const img=new Image();img.crossOrigin="anonymous";img.onload=()=>resolve(img);img.onerror=reject;img.src=url;});}


  // --------------------------- Virtual Art 1.0 ---------------------------
  function setArtProgress(percent,label){if(!els.artProgressWrap)return;els.artProgressWrap.classList.remove("hidden");els.artProgressBar.style.width=`${Math.max(0,Math.min(100,percent))}%`;els.artProgressLabel.textContent=label;}
  function seededRandom(seedText){let h=2166136261;for(const ch of String(seedText)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
  function artPromptTerms(prompt,code){const tokens=contentTokens(prompt,code).filter(x=>x.length>1);const groups=conceptGroups(prompt,code);const generic=new Set(["image","picture","photo","art","artwork","imagen","foto","arte","genera","generar","crear","create","make","draw"]);return [...new Set([...groups.slice(0,3),...tokens].filter(x=>!generic.has(normalize(x))))].slice(0,6);}
  async function commonsArtSearch(query,limit=6){
    const p=new URLSearchParams({action:"query",generator:"search",gsrsearch:query,gsrnamespace:"6",gsrlimit:String(limit),prop:"imageinfo|info",iiprop:"url|extmetadata",iiurlwidth:"900",inprop:"url",format:"json",origin:"*"});
    const r=await fetch(`https://commons.wikimedia.org/w/api.php?${p}`);if(!r.ok)throw new Error(`Commons ${r.status}`);const d=await r.json();
    return Object.values(d.query?.pages||{}).map(page=>{const ii=page.imageinfo?.[0]||{},meta=ii.extmetadata||{};return{title:(page.title||"").replace(/^File:/,""),thumb:ii.thumburl||ii.url,url:page.fullurl||ii.descriptionurl||"",description:stripHtml(meta.ImageDescription?.value||meta.ObjectName?.value||""),artist:stripHtml(meta.Artist?.value||""),license:stripHtml(meta.LicenseShortName?.value||meta.UsageTerms?.value||"")};}).filter(x=>x.thumb);
  }
  function drawCover(ctx,img,x,y,w,h){const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight),sw=w/scale,sh=h/scale,sx=(img.naturalWidth-sw)/2,sy=(img.naturalHeight-sh)/2;ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);}
  function roundedClip(ctx,x,y,w,h,r){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();ctx.clip();}
  function artTintFromPrompt(prompt){const n=normalize(prompt);if(/verde|green|ירוק|vert|grun|verde|зелен|أخضر|緑|초록|绿色/.test(n))return[25,130,70];if(/azul|blue|כחול|bleu|blau|blu|azul|син|أزرق|青|파랑|蓝/.test(n))return[25,75,150];if(/rojo|red|אדום|rouge|rot|rosso|vermelho|красн|أحمر|赤|빨강|红/.test(n))return[150,45,45];if(/violet|purple|morado|סגול|violet|lila|viola|roxo|фиолет|بنفسجي|紫|보라/.test(n))return[105,55,150];return[20,95,55];}
  async function generateVirtualArt(){
    if(state.artBusy)return;if(!isOnline()){els.artResult.innerHTML=`<div class="result-card"><div class="result-title">Virtual Art necesita conexión</div><p>Estoy offline. No voy a fingir una composición porque este modelo necesita buscar las capas visuales en Wikimedia Commons.</p></div>`;return;}const prompt=els.artPrompt?.value.trim();if(!prompt)return;state.artBusy=true;els.artGenerateBtn.disabled=true;els.artResult.innerHTML="";setArtProgress(4,"Interpretando la solicitud…");
    const code=resolveLanguage(prompt),terms=artPromptTerms(prompt,code);const queries=[prompt,...terms].slice(0,5);let candidates=[];
    try{
      setArtProgress(12,"Buscando material visual en Wikimedia Commons…");
      const batches=await Promise.all(queries.map(q=>commonsArtSearch(q,5).catch(()=>[])));candidates=[...new Map(batches.flat().map(x=>[x.thumb,x])).values()].slice(0,12);
      if(!candidates.length)throw new Error("No se encontraron imágenes utilizables en Wikimedia Commons.");
      setArtProgress(30,`Cargando ${Math.min(8,candidates.length)} capas visuales…`);
      const loaded=[];for(let i=0;i<candidates.length&&loaded.length<8;i++){try{const img=await loadRemoteImage(candidates[i].thumb);loaded.push({img,meta:candidates[i]});setArtProgress(30+(loaded.length/8)*30,`Cargando capas ${loaded.length}/8…`);}catch{}}
      if(!loaded.length)throw new Error("Las imágenes encontradas no pudieron cargarse con CORS.");
      const canvas=document.createElement("canvas");canvas.width=1024;canvas.height=1024;const ctx=canvas.getContext("2d");const rand=seededRandom(prompt);const tint=artTintFromPrompt(prompt);
      const bg=ctx.createLinearGradient(0,0,1024,1024);bg.addColorStop(0,`rgb(${Math.round(tint[0]*.18)},${Math.round(tint[1]*.18)},${Math.round(tint[2]*.18)})`);bg.addColorStop(1,"#020806");ctx.fillStyle=bg;ctx.fillRect(0,0,1024,1024);
      setArtProgress(64,"Componiendo la base…");ctx.save();ctx.globalAlpha=.72;drawCover(ctx,loaded[0].img,0,0,1024,1024);ctx.restore();
      const overlay=ctx.createLinearGradient(0,0,0,1024);overlay.addColorStop(0,"rgba(0,0,0,.08)");overlay.addColorStop(1,"rgba(0,0,0,.42)");ctx.fillStyle=overlay;ctx.fillRect(0,0,1024,1024);
      for(let i=1;i<loaded.length;i++){
        setArtProgress(64+(i/(Math.max(1,loaded.length-1)))*28,`Colocando capa ${i+1}/${loaded.length}…`);const {img}=loaded[i];const w=290+rand()*430,h=w*(.65+rand()*.5),x=-80+rand()*(1024-w+160),y=-60+rand()*(1024-h+120),rot=(rand()-.5)*.42;
        ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(rot);ctx.translate(-w/2,-h/2);roundedClip(ctx,0,0,w,h,28+rand()*70);ctx.globalAlpha=.48+rand()*.38;ctx.globalCompositeOperation=i%4===0?"screen":"source-over";drawCover(ctx,img,0,0,w,h);ctx.restore();
        ctx.save();ctx.strokeStyle=`rgba(${tint[0]},${tint[1]},${tint[2]},.22)`;ctx.lineWidth=2;ctx.strokeRect(Math.max(0,x),Math.max(0,y),Math.min(w,1024-Math.max(0,x)),Math.min(h,1024-Math.max(0,y)));ctx.restore();
      }
      const vignette=ctx.createRadialGradient(512,480,180,512,512,710);vignette.addColorStop(0,"rgba(0,0,0,0)");vignette.addColorStop(1,"rgba(0,0,0,.58)");ctx.fillStyle=vignette;ctx.fillRect(0,0,1024,1024);
      setArtProgress(96,"Renderizando PNG final…");const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("No se pudo crear el PNG.")),"image/png",.95));if(state.artObjectUrl)URL.revokeObjectURL(state.artObjectUrl);state.artObjectUrl=URL.createObjectURL(blob);
      const sources=loaded.map(x=>x.meta);const sourceHtml=sources.slice(0,8).map(s=>`<a class="source-link" href="${escapeAttr(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title)}${s.license?` · ${escapeHtml(s.license)}`:""}</a>`).join("<br>");
      els.artResult.innerHTML=`<div class="art-final"><img src="${escapeAttr(state.artObjectUrl)}" alt="Virtual Art result"><div class="art-final-actions"><a class="primary-btn art-download" href="${escapeAttr(state.artObjectUrl)}" download="virtual-art-${Date.now()}.png">⬇️ Guardar PNG</a></div><details class="art-sources"><summary>Fuentes visuales de Wikimedia Commons (${sources.length})</summary>${sourceHtml}</details></div>`;
      setArtProgress(100,"Imagen terminada");
    }catch(e){console.error(e);els.artResult.innerHTML=`<div class="media-result-card">No pude completar Virtual Art: ${escapeHtml(e.message||String(e))}</div>`;setArtProgress(100,"Generación detenida");}finally{state.artBusy=false;els.artGenerateBtn.disabled=false;}
  }
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

  // --------------------------- Helpers/events ---------------------------
  function showTraining(){els.chatWrap.classList.add("hidden");els.mediaPanel.classList.add("hidden");els.artPanel.classList.add("hidden");els.livePanel.classList.add("hidden");stopLiveMode();els.trainingPanel.classList.remove("hidden");els.composer.classList.add("hidden");updateTrainingStats();}
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
  document.addEventListener("click",e=>{const c=e.target.closest("[data-prompt]");if(c){setModel(["media","art","live"].includes(state.model)?"flash":state.model);sendMessage(c.dataset.prompt);}});

  if(els.languageSelect){els.languageSelect.value=state.language;els.languageSelect.addEventListener("change",()=>{state.language=els.languageSelect.value;localStorage.setItem("logic-ai-language",state.language);if(state.language!=="auto")resolveLanguage("");if(state.liveRecognition)state.liveRecognition.lang=speechLanguage();});}

  els.artGenerateBtn?.addEventListener("click",generateVirtualArt);
  els.artPrompt?.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter")generateVirtualArt();});

  els.liveStartBtn?.addEventListener("click",startLiveMode);
  els.liveStopBtn?.addEventListener("click",stopLiveMode);

  els.mediaInput.addEventListener("change",async()=>{const f=els.mediaInput.files?.[0];if(!f)return;try{if(f.type.startsWith("image/"))await analyzeImageFile(f);else if(f.type.startsWith("video/"))await analyzeVideoFile(f);else els.mediaResult.textContent="Formato no compatible.";}catch(e){console.error(e);els.mediaResult.innerHTML=`<div class="media-result-card">No pude analizar este archivo: ${escapeHtml(e.message||String(e))}</div>`;}});
  ["dragenter","dragover"].forEach(ev=>els.mediaDrop.addEventListener(ev,e=>{e.preventDefault();els.mediaDrop.style.borderColor="var(--green)";}));["dragleave","drop"].forEach(ev=>els.mediaDrop.addEventListener(ev,e=>{e.preventDefault();els.mediaDrop.style.borderColor="";}));els.mediaDrop.addEventListener("drop",async e=>{const f=e.dataTransfer.files?.[0];if(!f)return;const dt=new DataTransfer();dt.items.add(f);els.mediaInput.files=dt.files;els.mediaInput.dispatchEvent(new Event("change"));});

  loadVoices();if("speechSynthesis" in window)speechSynthesis.onvoiceschanged=loadVoices;
  window.addEventListener("online",updateNetworkUI);window.addEventListener("offline",updateNetworkUI);
  ensureChat();renderHistory();setModel(state.model);updateEmotionUI();updateNetworkUI();
  window.addEventListener("load",()=>{updateNetworkUI();trainBrain();renderActiveChat();els.userInput.focus();});
})();
