from pathlib import Path
root=Path(__file__).resolve().parents[1]
code=(root/'backend'/'Code.gs').read_text(encoding='utf-8')
assert "2026.09.04-v10.9-two-sheet-routing" in code
assert "const SST_LOG_SPREADSHEET_NAME = 'CORRESPONDENCIA ENVIADA SST 2026'" in code
assert "const SST_LOG_SHEET_NAME = 'Hoja 1'" in code
assert "const CONSECUTIVE_SPREADSHEET_NAME = 'CORRESPONDENCIA ENVIADA (1)'" in code
assert "const CONSECUTIVE_EXTERNAL_SHEET_NAME = 'CONSECUTIVOS 2026'" in code
assert "['CONSECUTIVO','FECHA','NOMBRE','CARGO','EXAMEN']" in code
assert "['CONSECUTIVO','FECHA','NOMBRE','ASUNTO']" in code
assert "RECOMMENDATION_REGISTER_LABEL = 'RECOMENDACIÓN MEDICA'" in code
for fn in ['nextConsecutive_', 'reserveConsecutives_']:
    s=code.index('function '+fn)
    e=code.find('\nfunction ',s+10)
    block=code[s:e if e!=-1 else None]
    assert 'ensureConsecutiveDataColumns_' not in block
print('OK · V10.9 routing exacto de los dos Google Sheets')
