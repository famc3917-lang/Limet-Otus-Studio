# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 博成 · FMLC
# Additional terms: see ADDITIONAL_TERMS.md
import hashlib, importlib.util, json, pathlib, tempfile, urllib.request
root = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('voice_download', root/'tts/download.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
urllib.request.urlopen = lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError('Network must not be used'))
with tempfile.TemporaryDirectory(prefix='guanyu-bundled-voice-') as directory:
    base = pathlib.Path(directory)
    source = base/'resources/model'
    source.mkdir(parents=True)
    assets = []
    for name in module.FILES:
        content = ('synthetic-asset:'+name).encode()
        (source/name).write_bytes(content)
        assets.append({'name':name, 'sha256':hashlib.sha256(content).hexdigest()})
    manifest = source.parent/'MODEL.json'
    manifest.write_text(json.dumps({'revision':'synthetic', 'files':assets}), encoding='utf-8')
    home = base/'installed'
    module.install(home, manifest)
    assert (home/'model-ready.json').exists()
    for item in assets:
        assert (home/'model'/item['name']).read_bytes() == (source/item['name']).read_bytes()
    module.install(home, manifest)
    (source/module.FILES[0]).write_bytes(b'corrupted')
    try:
        module.install(base/'corrupt-target', manifest)
    except RuntimeError as error:
        assert 'integrity' in str(error)
    else:
        raise AssertionError('Corrupt bundled model accepted')
    assert not (base/'corrupt-target/model-ready.json').exists()
print('PASS bundled model installation, cached reuse, no network and corrupt-resource rejection')
