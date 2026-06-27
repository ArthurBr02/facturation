// HTML template for the livre des recettes PDF.
// Legal requirement for micro-entreprise (art. 50-0 and 102 ter du CGI).
// Phase 4 — Sprint 4.4.

const euro = (n) =>
  Number(n).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });

const dateF = (d) => new Date(d).toLocaleDateString('fr-FR');

export function renderLivreRecettes({ annee, emetteur, lignes }) {
  const total = lignes.reduce((s, l) => s + Number(l.montant), 0);

  const rows = lignes
    .map(
      (l, i) => `
    <tr>
      <td style="color:#6b7280">${i + 1}</td>
      <td>${dateF(l.date)}</td>
      <td><strong>${l.reference}</strong></td>
      <td>${l.client || '—'}</td>
      <td style="color:#374151">${l.nature || '—'}</td>
      <td style="text-align:right;font-weight:600">${euro(l.montant)}</td>
    </tr>`,
    )
    .join('');

  const emetteurLine = [emetteur?.nom, emetteur?.siret ? `SIRET ${emetteur.siret}` : null, emetteur?.ville]
    .filter(Boolean)
    .join(' — ');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; }
  .page { padding: 0; }
  .header { background: #1e3a5f; color: white; padding: 20px 24px 16px; }
  .header-title { font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }
  .header-sub { font-size: 11px; opacity: 0.75; margin-top: 3px; }
  .meta { padding: 12px 24px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 10.5px; color: #475569; }
  .content { padding: 20px 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 0; }
  thead th {
    background: #f1f5f9;
    color: #374151;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    padding: 9px 8px;
    text-align: left;
    border-bottom: 2px solid #cbd5e1;
  }
  thead th:last-child { text-align: right; }
  tbody td { padding: 8px 8px; border-bottom: 1px solid #f1f5f9; font-size: 10.5px; vertical-align: top; }
  tbody tr:hover td { background: #fafafa; }
  .total-row td { padding: 10px 8px; background: #1e3a5f; color: white; font-weight: 700; font-size: 11px; }
  .total-row td:last-child { text-align: right; }
  .footer { margin-top: 24px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-title">Livre des recettes — ${annee}</div>
    <div class="header-sub">Régime micro-entreprise (art. 50-0 et 102 ter du CGI)</div>
  </div>
  <div class="meta">
    ${emetteurLine ? `<span>${emetteurLine}</span> &nbsp;·&nbsp; ` : ''}
    <span>Généré le ${dateF(new Date())}</span>
    &nbsp;·&nbsp; <span>${lignes.length} ligne(s)</span>
    &nbsp;·&nbsp; <span>Total : <strong>${euro(total)}</strong></span>
  </div>
  <div class="content">
    <table>
      <thead>
        <tr>
          <th style="width:32px">#</th>
          <th style="width:90px">Date</th>
          <th style="width:120px">Référence</th>
          <th style="width:180px">Client</th>
          <th>Nature</th>
          <th style="width:110px;text-align:right">Montant</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td colspan="5">TOTAL ${annee}</td>
          <td>${euro(total)}</td>
        </tr>
      </tbody>
    </table>
  </div>
  <div class="footer">
    Document généré automatiquement — Conservation obligatoire 10 ans (art. L123-22 du Code de commerce)
  </div>
</div>
</body>
</html>`;
}
