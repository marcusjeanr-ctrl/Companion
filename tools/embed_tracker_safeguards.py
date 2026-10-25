from pathlib import Path
root = Path(__file__).resolve().parents[1]
p = root / 'dist/backend.js'
s = p.read_text()
start, end = '// TRACKER SAFEGUARDS:BEGIN', '// TRACKER SAFEGUARDS:END'
block = start + '\n' + (root / 'engines/tracker_safeguards.js').read_text().rstrip() + '\n' + end
if start in s:
 a, b = s.index(start), s.index(end) + len(end)
 s = s[:a] + block + s[b:]
else:
 s = s.replace('function parseCompanion(text,', block + '\n\nfunction parseCompanion(text,', 1)
p.write_text(s)
