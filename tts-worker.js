// Nori's natural speaking voice (Kokoro, a small free voice model that runs on the phone).
import { KokoroTTS } from 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';

let tts = null, loading = null, loadedDtype = null;
function load(dtype = 'fp32') {
  if (loading && loadedDtype === dtype) return loading;
  loadedDtype = dtype; tts = null;
  loading = KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
    dtype, device: 'wasm',
    progress_callback: (p) => { if (p && p.status === 'progress') self.postMessage({ type: 'progress', file: p.file, progress: p.progress, loaded: p.loaded, total: p.total }); },
  }).then((t) => { tts = t; self.postMessage({ type: 'ready' }); return t; });
  return loading;
}
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'load') { await load(data.dtype); return; }
    if (data.type === 'say') {
      const t = await load(data.dtype || loadedDtype || 'fp32');
      const a = await t.generate(data.text, { voice: data.voice || 'af_bella', speed: data.speed || 1 });
      const buf = a.audio;
      self.postMessage({ type: 'audio', id: data.id, audio: buf, sr: a.sampling_rate }, [buf.buffer]);
    }
  } catch (e) {
    if (data.type === 'load') loading = null;
    self.postMessage({ type: 'error', id: data.id, message: String((e && e.message) || e).slice(0, 200) });
  }
};
