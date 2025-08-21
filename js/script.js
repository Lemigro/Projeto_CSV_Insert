// script.js — suporta .csv e .xlsx (primeira aba)
// Requer: <script src="https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js"></script>

document.getElementById('csvForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const ownerName = document.getElementById('ownerName').value.trim();
  const tableName = document.getElementById('tableName').value.trim();
  const file = document.getElementById('csvFile').files[0];

  if (!file || !tableName) {
    alert("Informe o nome da tabela e selecione o arquivo.");
    return;
  }

  const fullTableName = ownerName ? `${ownerName}.${tableName}` : tableName;
  const ext = (file.name.split('.').pop() || '').toLowerCase();

  if (ext === 'csv') {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const matrix = parseCSV(text);
      handleMatrixToSQL(matrix, fullTableName, tableName);
    };
    reader.readAsText(file, 'UTF-8');
  } else if (ext === 'xlsx') {
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const firstSheet = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheet];
      const matrix = XLSX.utils.sheet_to_json(ws, { header: 1 });
      handleMatrixToSQL(matrix, fullTableName, tableName);
    };
    reader.readAsArrayBuffer(file);
  } else {
    alert("Formato não suportado. Selecione .csv ou .xlsx.");
  }
});

function handleMatrixToSQL(matrix, fullTableName, tableName) {
  if (!matrix || matrix.length === 0) {
    alert('Arquivo vazio ou inválido.');
    return;
  }

  const headers = (matrix[0] || []).map(h => String(h ?? '').trim()).filter(Boolean);
  if (headers.length === 0) {
    alert('Não foi possível identificar os cabeçalhos.');
    return;
  }

  const inserts = [];
  for (let i = 1; i < matrix.length; i++) {
    const rowArr = matrix[i] || [];
    const cells = headers.map((_, colIdx) => formatValue(rowArr[colIdx]));
    if (cells.length !== headers.length) continue;

    const insert = `INSERT INTO ${fullTableName} (${headers.join(', ')}) VALUES (${cells.join(', ')});`;
    inserts.push(insert);
  }

  if (inserts.length === 0) {
    alert('Nenhuma linha de dados encontrada após o cabeçalho.');
    return;
  }

  const blob = new Blob([inserts.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);

  const link = document.getElementById('downloadLink');
  link.href = url;
  link.download = `${tableName}_inserts.sql`;
  link.style.display = 'inline-block';
  link.textContent = '⬇️ Baixar INSERTs';
}

/** Heurística de tipos:
 * - vazio/undefined/null -> NULL
 * - number (já tipado do XLSX) -> sem aspas
 * - boolean "true"/"false" -> sem aspas
 * - número decimal com ponto (123.45) -> sem aspas
 * - número decimal com vírgula (123,45) -> troca vírgula por ponto, sem aspas
 * - senão -> string com aspas e escape de '
 */
function formatValue(v) {
  if (v === undefined || v === null) return 'NULL';

  if (typeof v === 'number' && isFinite(v)) return String(v);

  let s = String(v).trim();
  if (s === '') return 'NULL';

  if (/^(true|false)$/i.test(s)) return s.toLowerCase();

  if (/^[+-]?\d+(\.\d+)?$/.test(s)) return s;         // 123 ou 123.45
  if (/^[+-]?\d+,\d+$/.test(s)) return s.replace(',', '.'); // 123,45 -> 123.45

  return `'${s.replace(/'/g, "''")}'`;
}

/** CSV parser simples, detecta delimitador (;, , ou \t) e respeita aspas duplas */
function parseCSV(text) {
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const firstLine = (text.split('\n').find(l => l.trim() !== '') || '');
  const candidates = [';', ',', '\t'];
  let delimiter = ',';
  let maxHits = -1;
  for (const cand of candidates) {
    const hits = (firstLine.match(new RegExp(escapeRegExp(cand), 'g')) || []).length;
    if (hits > maxHits) { maxHits = hits; delimiter = cand; }
  }

  return csvToMatrix(text, delimiter)
    // remove linhas completamente vazias
    .filter(r => r.some(c => String(c ?? '').trim() !== ''));
}

/** Converte CSV para matriz (RFC4180 básico: aspas, delimitador e quebra de linha) */
function csvToMatrix(text, delimiter) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') { field += '"'; i++; } // escape ""
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(field);
        field = '';
      } else if (ch === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }
  // último campo/linha se não terminar com \n
  row.push(field);
  rows.push(row);
  return rows;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
