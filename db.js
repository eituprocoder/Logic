const DB_NAME = "logic-ai-db";
const DB_VERSION = 1;

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("chats")) {
        const s = db.createObjectStore("chats", { keyPath: "id" });
        s.createIndex("updatedAt", "updatedAt");
      }
      if (!db.objectStoreNames.contains("messages")) {
        const s = db.createObjectStore("messages", { keyPath: "id" });
        s.createIndex("chatId", "chatId");
        s.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains("projects")) {
        const s = db.createObjectStore("projects", { keyPath: "id" });
        s.createIndex("chatId", "chatId");
      }
      if (!db.objectStoreNames.contains("preferences")) {
        db.createObjectStore("preferences", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(store, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const os = tx.objectStore(store);
    let result;
    try { result = fn(os); } catch (e) { reject(e); return; }
    tx.oncomplete = async () => {
      if (result instanceof IDBRequest) resolve(result.result);
      else resolve(await result);
    };
    tx.onerror = () => reject(tx.error);
  });
}

export const DB = {
  async put(store, value) {
    return withStore(store, "readwrite", os => os.put(value));
  },
  async get(store, key) {
    return withStore(store, "readonly", os => os.get(key));
  },
  async delete(store, key) {
    return withStore(store, "readwrite", os => os.delete(key));
  },
  async all(store) {
    return withStore(store, "readonly", os => os.getAll());
  },
  async byIndex(store, index, value) {
    return withStore(store, "readonly", os => os.index(index).getAll(value));
  },
  async clear(store) {
    return withStore(store, "readwrite", os => os.clear());
  }
};

export async function enforceChatLimit(limit = 100) {
  const chats = (await DB.all("chats")).sort((a,b) => b.updatedAt - a.updatedAt);
  const doomed = chats.slice(limit);
  for (const chat of doomed) {
    const messages = await DB.byIndex("messages", "chatId", chat.id);
    const projects = await DB.byIndex("projects", "chatId", chat.id);
    for (const m of messages) await DB.delete("messages", m.id);
    for (const p of projects) await DB.delete("projects", p.id);
    await DB.delete("chats", chat.id);
  }
}

export async function getPreference(key, fallback = "") {
  const row = await DB.get("preferences", key);
  return row?.value ?? fallback;
}

export async function setPreference(key, value) {
  return DB.put("preferences", { key, value });
}
