// Nori's natural speaking voice (Kokoro, a small free voice model that runs on the phone).
import { KokoroTTS } from 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';

const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
let tts = null, loading = null, loadedDtype = null, device = null;
const opts = (dtype, dev) => ({ dtype, device: dev,
  progress_callback: (p) => { if (p && p.status === 'progress') self.postMessage({ type: 'progress', file: p.file, progress: p.progress, loaded: p.loaded, total: p.total }); } });
async function tryLoad(dtype, dev) {
  return KokoroTTS.from_pretrained(MODEL, opts(dtype, dev));
}
function load(dtype = 'fp32', forceWasm = false) {
  if (loading && loadedDtype === dtype && !forceWasm) return loading;
  loadedDtype = dtype; tts = null;
  // the phone's graphics chip speaks much faster; fall back to the normal processor if it can't
  // (the graphics chip is busy running Nori's mind, so the voice uses the normal processor; it's reliable there)
  const gpu = false && !forceWasm;
  loading = (async () => {
    let t = null;
    if (gpu) { try { t = await tryLoad(dtype, 'webgpu'); device = 'webgpu'; } catch (e) { console.warn('webgpu voice failed, using wasm', e); } }
    if (!t) { t = await tryLoad(dtype, 'wasm'); device = 'wasm'; }
    tts = t; self.postMessage({ type: 'ready', device }); return t;
  })();
  loading.catch(() => { loading = null; });
  return loading;
}
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'load') { await load(data.dtype); return; }
    if (data.type === 'say') {
      let t = await load(data.dtype || loadedDtype || 'fp32'), a;
      try { a = await t.generate(data.text, { voice: data.voice || 'af_bella', speed: data.speed || 1 }); }
      catch (e) {
        if (device !== 'webgpu') throw e;
        t = await load(loadedDtype, true); self.postMessage({ type: 'device', device });
        a = await t.generate(data.text, { voice: data.voice || 'af_bella', speed: data.speed || 1 });
      }
      const buf = a.audio;
      self.postMessage({ type: 'audio', id: data.id, audio: buf, sr: a.sampling_rate }, [buf.buffer]);
    }
  } catch (e) {
    self.postMessage({ type: 'error', id: data.id, message: String((e && e.message) || e).slice(0, 200) });
  }
};
