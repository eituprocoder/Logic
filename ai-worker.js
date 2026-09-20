import { pipeline, TextStreamer } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

let generator = null;
let loadedModel = null;
let loadedDevice = null;

async function loadModel(model, preferWebGPU = true) {
  const device = preferWebGPU && self.navigator?.gpu ? "webgpu" : "wasm";
  if (generator && loadedModel === model && loadedDevice === device) return;

  self.postMessage({ type: "loading", message: `Cargando ${model} en ${device.toUpperCase()}…`, progress: 0 });

  try {
    generator = await pipeline("text-generation", model, {
      device,
      dtype: device === "webgpu" ? "q4" : "q8",
      progress_callback: (p) => {
        let progress = null;
        if (typeof p?.progress === "number") progress = Math.max(0, Math.min(100, p.progress));
        self.postMessage({
          type: "progress",
          status: p?.status || "loading",
          file: p?.file || "",
          progress
        });
      }
    });
    loadedModel = model;
    loadedDevice = device;
    self.postMessage({ type: "ready", model, device });
  } catch (err) {
    // Some devices expose navigator.gpu but cannot run a given graph.
    if (device === "webgpu") {
      self.postMessage({ type: "loading", message: "WebGPU falló; intentando WASM/CPU…", progress: 0 });
      generator = await pipeline("text-generation", model, {
        device: "wasm",
        dtype: "q8",
        progress_callback: (p) => {
          self.postMessage({ type: "progress", status: p?.status || "loading", file: p?.file || "", progress: p?.progress ?? null });
        }
      });
      loadedModel = model;
      loadedDevice = "wasm";
      self.postMessage({ type: "ready", model, device: "wasm" });
    } else {
      throw err;
    }
  }
}

self.onmessage = async (event) => {
  const data = event.data || {};
  try {
    if (data.type === "load") {
      await loadModel(data.model, data.preferWebGPU !== false);
      return;
    }

    if (data.type === "generate") {
      await loadModel(data.model, data.preferWebGPU !== false);

      let full = "";
      const streamer = new TextStreamer(generator.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (text) => {
          full += text;
          self.postMessage({ type: "token", requestId: data.requestId, text });
        }
      });

      const result = await generator(data.messages, {
        max_new_tokens: data.maxNewTokens || 768,
        do_sample: false,
        repetition_penalty: 1.08,
        streamer
      });

      let finalText = full.trim();
      if (!finalText) {
        const generated = result?.[0]?.generated_text;
        if (Array.isArray(generated)) finalText = generated.at(-1)?.content || "";
        else if (typeof generated === "string") finalText = generated;
      }
      self.postMessage({ type: "done", requestId: data.requestId, text: finalText });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      requestId: data.requestId,
      message: error?.message || String(error)
    });
  }
};
