from pathlib import Path
root=Path(__file__).resolve().parents[1]
code=(root/'Code.gs').read_text(encoding='utf-8')
app=(root/'js/app.js').read_text(encoding='utf-8')
gen=(root/'js/generator.js').read_text(encoding='utf-8')
config=(root/'js/config.js').read_text(encoding='utf-8')
assert "BACKEND_VERSION = '2026.09.03-v10.7-consecutive-full-sync'" in code
assert 'CONSECUTIVE_DATA_FIELDS' in code
for field in ['EXAMENES REALIZADOS','RECOMENDACIONES','RESTRICCIONES','OBSERVACIONES','REMISIONES','PROGRAMA VIGILANCIA','VALIDADO IA','DOCUMENT_KEY']:
    assert field in code, field
assert 'ensureConsecutiveDataColumns_' in code
assert 'syncDocumentToConsecutiveSheet_' in code
assert 'consecutiveSheetSync' in code
assert 'data:SSTUtils.deepClone(data || {})' in gen
assert 'data:SSTUtils.deepClone(d.data || {})' in gen
assert 'v10.7-consecutive-full-sync' in config
assert 'consecutiveSheetSync?.errors' in app
assert (root/'Code.gs').read_bytes() == (root/'backend/Code.gs').read_bytes()
assert (root/'app.js').read_bytes() == (root/'js/app.js').read_bytes()
assert (root/'generator.js').read_bytes() == (root/'js/generator.js').read_bytes()
assert (root/'config.js').read_bytes() == (root/'js/config.js').read_bytes()
print('OK · V10.7 sincronización completa con hoja operativa de consecutivos')
