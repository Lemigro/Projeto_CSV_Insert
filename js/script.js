document.getElementById('csvForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const ownerName = document.getElementById('ownerName').value.trim();
  const tableName = document.getElementById('tableName').value.trim();
  const file = document.getElementById('csvFile').files[0];

  if (!file || !tableName) {
    alert("Informe o nome da tabela e selecione o CSV.");
    return;
  }

  const reader = new FileReader();

  reader.onload = function (event) {
    const csv = event.target.result;
    const lines = csv.split('\n').filter(line => line.trim() !== '');

    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';

    const headers = firstLine.split(delimiter).map(h => h.trim());

    const inserts = [];
    const fullTableName = ownerName ? `${ownerName}.${tableName}` : tableName;

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(delimiter).map(cell => {
        const value = cell.trim().replace(/'/g, "''");
        return value === '' ? 'NULL' : `'${value}'`;
      });

      if (row.length !== headers.length) continue;

      const insert = `INSERT INTO ${fullTableName} (${headers.join(', ')}) VALUES (${row.join(', ')});`;
      inserts.push(insert);
    }

    const blob = new Blob([inserts.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const link = document.getElementById('downloadLink');
    link.href = url;
    link.download = `${tableName}_inserts.sql`;
    link.style.display = 'inline-block';
    link.textContent = '⬇️ Baixar INSERTs';
  };

  reader.readAsText(file, 'UTF-8');
});
