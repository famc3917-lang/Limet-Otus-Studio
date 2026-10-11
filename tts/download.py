# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 博成 · FMLC
# Additional terms: see ADDITIONAL_TERMS.md
"""Pinned official SFT assets; no reference-audio models required for preset voices."""
import concurrent.futures, hashlib, json, os, pathlib, shutil, sys, time, urllib.request

REPO = 'FunAudioLLM/CosyVoice-300M-SFT'
FILES = ['cosyvoice.yaml', 'spk2info.pt', 'llm.pt', 'flow.pt', 'hift.pt']

def install(home, manifest_path):
    home = pathlib.Path(home).resolve()
    manifest = json.loads(pathlib.Path(manifest_path).read_text(encoding='utf-8'))
    model = home / 'model'
    model.mkdir(parents=True, exist_ok=True)
    if [asset['name'] for asset in manifest['files']] != FILES:
        raise RuntimeError('Unexpected model manifest')
    def file_digest(target):
        digest = hashlib.sha256()
        with target.open('rb') as source:
            for block in iter(lambda: source.read(1024**2), b''):
                digest.update(block)
        return digest.hexdigest()
    def fetch(item):
        target = model / item['name']
        if target.exists() and file_digest(target) == item['sha256']:
            return
        temporary = target.with_suffix(target.suffix + '.partial')
        bundled = pathlib.Path(manifest_path).resolve().parent / 'model' / item['name']
        if bundled.is_file():
            if file_digest(bundled) != item['sha256']:
                raise RuntimeError('Bundled model integrity check failed: ' + item['name'])
            shutil.copyfile(bundled, temporary)
            if file_digest(temporary) != item['sha256']:
                raise RuntimeError('Copied model integrity check failed: ' + item['name'])
            os.replace(temporary, target)
            print(json.dumps({'phase':'model','file':item['name'],'source':'bundled','done':True}), flush=True)
            return
        url = f"https://huggingface.co/{REPO}/resolve/{manifest['revision']}/{item['name']}?download=true"
        request = urllib.request.Request(url, headers={'User-Agent':'Guanyu-Limenotus/2.3.0'})
        with urllib.request.urlopen(request, timeout=90) as response, temporary.open('wb') as output:
            digest = hashlib.sha256()
            while block := response.read(1024 * 1024):
                output.write(block)
                digest.update(block)
        if digest.hexdigest() != item['sha256']:
            raise RuntimeError('Model integrity check failed: ' + item['name'])
        os.replace(temporary, target)
        print(json.dumps({'phase':'model','file':item['name'],'done':True}), flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(fetch, manifest['files']))
    (home / 'model-ready.json').write_text(json.dumps({'revision':manifest['revision'],'verified':True}),encoding='utf-8')

if __name__ == '__main__':
    install(sys.argv[1],sys.argv[2])
