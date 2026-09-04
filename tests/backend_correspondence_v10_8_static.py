from pathlib import Path
root=Path(__file__).resolve().parents[1]
code=(root/'backend/Code.gs').read_text(encoding='utf-8')
app=(root/'js/app.js').read_text(encoding='utf-8')
gen=(root/'js/generator.js').read_text(encoding='utf-8')
config=(root/'js/config.js').read_text(encoding='utf-8')
index=(root/'index.html').read_text(encoding='utf-8')
assert "2026.09.04-v10.8-correspondence-sync" in code
assert "2026.09.04-v10.8-correspondence-sync" in config
assert "Correspondencia Enviada" in code
assert "appendCorrespondenceRecords_" in code
assert "case 'correspondenceStatus'" in code
assert "case 'syncConsecutiveRecord'" in code
assert "case 'syncConsecutiveRecords'" in code
assert "records" in app and "correspondenceRecord" in app
assert "settingsCorrespondenceSheet" in index and "settingsCorrespondenceSheet" in app
assert "syncConsecutiveRecord" in gen and "syncConsecutiveRecords" in gen
assert "correspondence:correspondence" in code
print('OK · V10.8 correspondencia enviada + sincronización completa de consecutivos')
