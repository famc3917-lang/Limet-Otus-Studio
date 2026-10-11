# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 博成 · FMLC
# Additional terms: see ADDITIONAL_TERMS.md
"""Persistent preset-voice worker. Text-only SFT; no reference-audio encoder or training."""
import contextlib, gc, hashlib, io, json, os, pathlib, re, sys, time, wave, threading

os.environ.pop('PYTHONPATH', None)
sys.stdin.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
home = pathlib.Path(sys.argv[1]).resolve()
vendor = pathlib.Path(sys.argv[2]).resolve()
sys.path[:0] = [str(vendor), str(vendor / 'third_party/Matcha-TTS')]
protocol = sys.stdout
sys.stdout = sys.stderr
policy = json.loads((pathlib.Path(__file__).parent / 'RESOURCE-POLICY.json').read_text())
manifest = json.loads((pathlib.Path(__file__).parent / 'MODEL.json').read_text())
for asset in manifest['files']:
    sha = hashlib.sha256()
    with (home / 'model' / asset['name']).open('rb') as model_file:
        for chunk in iter(lambda: model_file.read(1024**2), b''):
            sha.update(chunk)
    if sha.hexdigest().lower() != asset['sha256'].lower():
        raise RuntimeError('Model integrity verification failed')
import psutil
process = psutil.Process()
peak_rss = 0
def memory_guard():
    global peak_rss
    while True:
        rss = process.memory_info().rss
        peak_rss = max(peak_rss, rss)
        if rss > policy['workerRamMiB'] * 1024 ** 2:
            os._exit(96)
        time.sleep(0.5)
threading.Thread(target=memory_guard, daemon=True).start()
import torch
from hyperpyyaml import load_hyperpyyaml
from cosyvoice.cli.model import CosyVoiceModel
from whisper.tokenizer import get_tokenizer

torch.set_num_threads(policy['threads'])
torch.set_num_interop_threads(1)
device = 'cpu'
if torch.cuda.is_available() and os.environ.get('STUDIO_TTS_DEVICE') != 'cpu':
    free, total = torch.cuda.mem_get_info()
    if free >= policy['minimumFreeCudaMiB'] * 1024 ** 2:
        device = 'cuda'
        torch.cuda.set_per_process_memory_fraction(min(0.9, policy['cudaAllocatorMiB'] * 1024 ** 2 / total), 0)
if device == 'cpu':
    torch.cuda.is_available = lambda: False

def load_model(target):
    # The official YAML also declares training datasets; preset inference only uses model sections.
    configuration = (home / 'model/cosyvoice.yaml').read_text(encoding='utf-8').split('# processor functions')[0]
    with contextlib.redirect_stdout(sys.stderr):
        config = load_hyperpyyaml(io.StringIO(configuration))
    model = CosyVoiceModel(config['llm'], config['flow'], config['hift'], fp16=target == 'cuda')
    model.device = torch.device(target)
    model.load(*(str(home / 'model' / name) for name in ['llm.pt','flow.pt','hift.pt']))
    return model

try:
    engine = load_model(device)
except torch.cuda.OutOfMemoryError:
    gc.collect()
    torch.cuda.empty_cache()
    device = 'cpu'
    # Official constructors auto-detect CUDA. Mask it only in this private worker for CPU fallback.
    torch.cuda.is_available = lambda: False
    engine = load_model('cpu')
tokenizer = get_tokenizer(multilingual=True, num_languages=100, language='en', task='transcribe')
voices = torch.load(home / 'model/spk2info.pt', map_location=device, weights_only=True)
def reply(value):
    protocol.write(json.dumps(value,ensure_ascii=True)+'\n')
    protocol.flush()
reply({'ready':True,'speakers':list(voices),'device':device,'sampleRate':22050,'peakRamMiB':round(peak_rss/1024**2)})
for line in sys.stdin:
    job = None
    try:
        job = json.loads(line)
        text = job.get('text','')
        speaker = job.get('speakerId')
        if not isinstance(text,str) or not 1 <= len(text.strip()) <= policy['maximumTextCharacters'] or speaker not in voices:
            raise ValueError('Invalid speech text or speaker')
        segments = [segment for segment in re.split(r'(?<=[。！？!?\n])', text.strip()) if segment.strip()]
        parts = []
        with torch.inference_mode():
            for segment in segments:
                for start in range(0,len(segment),80):
                    tokens = torch.tensor([tokenizer.encode(segment[start:start+80],allowed_special='all')],dtype=torch.int32,device=device)
                    embedding = voices[speaker]['embedding']
                    for output in engine.tts(text=tokens,text_len=torch.tensor([tokens.shape[1]],dtype=torch.int32,device=device),llm_embedding=embedding,flow_embedding=embedding,stream=False):
                        parts.append(output['tts_speech'].detach().cpu())
        audio = torch.cat(parts,dim=1).clamp(-1,1)
        if audio.shape[1] > 22050 * policy['maximumAudioSeconds']:
            raise ValueError('Speech duration exceeds budget')
        data = io.BytesIO()
        with wave.open(data,'wb') as wav:
            wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(22050)
            wav.writeframes((audio.numpy().reshape(-1)*32767).astype('int16').tobytes())
        import base64
        reply({'id':job['id'],'wav':base64.b64encode(data.getvalue()).decode(),'duration':audio.shape[1]/22050,'device':device,'peakRamMiB':round(peak_rss/1024**2),'peakCudaMiB':round(torch.cuda.max_memory_allocated()/1024**2) if device=='cuda' else 0})
        del audio, parts
    except Exception as error:
        import traceback
        traceback.print_exc(file=sys.stderr)
        reply({'id':job.get('id') if isinstance(job,dict) else None,'error':type(error).__name__})
