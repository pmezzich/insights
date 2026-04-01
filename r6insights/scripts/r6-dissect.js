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
    // Try instantiateStreaming first
    if (WebAssembly.instantiateStreaming) {
      try {
        const res = await WebAssembly.instantiateStreaming(fetch(WASM_URL), importObj);
        console.log("[r6-dissect v3] instantiateStreaming ok with", label);
        gojs.run(res.instance);
        return true;
      } catch (e) {
        console.warn("[r6-dissect v3] instantiateStreaming failed with", label, e);
      }
    }
    // Fallback: fetch ArrayBuffer
    const resp = await fetch(WASM_URL);
    const bytes = await resp.arrayBuffer();
    const res2 = await WebAssembly.instantiate(bytes, importObj);
    console.log("[r6-dissect v3] instantiate(ArrayBuffer) ok with", label);
    gojs.run(res2.instance);
    return true;
  }

  async function initWasm() {
    if (_initPromise) return _initPromise;
    _initPromise = (async () => {
      // 1) Standard Go imports
      try {
        await tryInstantiate(gojs.importObject, "gojs.importObject");
        return true;
      } catch (e1) {
        console.warn("[r6-dissect v3] standard Go imports failed, trying {gojs: gojs} adapter…", e1);
      }
      // 2) Adapter for modules expecting a "gojs" import namespace
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

  // Public API similar to earlier
  window.createDissectModule = async function createDissectModule() {
    await initWasm();
    const mod = {
      parseReplay: (typeof window.parseReplay === "function") ? window.parseReplay : undefined,
      cwrap: function () { throw new Error("cwrap not available in Go-based build"); },
      _malloc: function () { throw new Error("malloc not available in Go-based build"); },
      _free: function () {},
      HEAPU8: new Uint8Array(0),
      UTF8ToString: function () { throw new Error("UTF8ToString not available in Go-based build"); }
    };
    window.dissectModule = mod;
    return mod;
  };

  // Eager init — wire up parseReplay on dissectModule once WASM is ready
  initWasm().then(() => {
    if (typeof window.parseReplay === "function") {
      window.dissectModule = window.dissectModule || {};
      window.dissectModule.parseReplay = window.parseReplay;
    }
  });
})();