(function () {
  console.log("[r6-dissect v3] loader starting");
  if (typeof Go !== "function") {
    console.error("[r6-dissect v3] wasm_exec.js (Go runtime) is missing.");
    return;
  }
  var gojs = new Go();

  var WASM_URL = (window.R6_WASM_URL || "r6-dissect.wasm");
  var _initPromise = null;

  async function tryInstantiate(importObj, label) {
    if (WebAssembly.instantiateStreaming) {
      try {
        const res = await WebAssembly.instantiateStreaming(fetch(WASM_URL), importObj);
        gojs.run(res.instance);
        // Go's main() runs synchronously before select{} yields back to JS.
        // window.parseReplay must be set by now — no polling needed.
        if (typeof window.parseReplay === "function") {
          console.log("[r6-dissect v3] parseReplay registered OK (streaming)");
          return true;
        }
        throw new Error("parseReplay not set after gojs.run() — WASM may be wrong build");
      } catch (e) {
        console.warn("[r6-dissect v3] instantiateStreaming failed with", label, e);
      }
    }
    const resp = await fetch(WASM_URL);
    const bytes = await resp.arrayBuffer();
    const res2 = await WebAssembly.instantiate(bytes, importObj);
    gojs.run(res2.instance);
    if (typeof window.parseReplay === "function") {
      console.log("[r6-dissect v3] parseReplay registered OK (arraybuffer)");
      return true;
    }
    throw new Error("parseReplay not set after gojs.run() — WASM may be wrong build");
  }

  async function initWasm() {
    if (_initPromise) return _initPromise;
    _initPromise = (async () => {
      try {
        await tryInstantiate(gojs.importObject, "gojs.importObject");
        return true;
      } catch (e1) {
        console.warn("[r6-dissect v3] standard imports failed, trying adapter...", e1);
      }
      try {
        await tryInstantiate({ gojs: gojs }, "{ gojs: gojs }");
        return true;
      } catch (e2) {
        console.error("[r6-dissect v3] all instantiation attempts failed:", e2);
        throw e2;
      }
    })();
    return _initPromise;
  }

  // Public API — resolves once window.parseReplay is confirmed set.
  window.createDissectModule = async function createDissectModule() {
    await initWasm();
    const mod = {
      parseReplay: window.parseReplay,
      cwrap: function () { throw new Error("cwrap not available in Go-based build"); },
      _malloc: function () { throw new Error("malloc not available in Go-based build"); },
      _free: function () {},
      HEAPU8: new Uint8Array(0),
      UTF8ToString: function () { throw new Error("UTF8ToString not available in Go-based build"); }
    };
    window.dissectModule = mod;
    return mod;
  };

  // Eager init — wire up as soon as WASM is ready.
  initWasm().then(() => {
    window.dissectModule = window.dissectModule || {};
    window.dissectModule.parseReplay = window.parseReplay;
  });
})();
