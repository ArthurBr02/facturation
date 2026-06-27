// Conforming amendment (avenant) HTML, rendered server-side from a frozen snapshot.
const fmt = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const euro = (n) => `${fmt.format(n || 0)} €`;

function frDate(d) {
  return d ? new Date(d).toLocaleDateString('fr-FR') : '—';
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function row(k, v) {
  return v ? `<div class="row"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>` : '';
}

/** Render the full HTML document for an avenant snapshot. */
export function renderAvenantHtml(snap) {
  const em = snap.emetteur || {};
  const cl = snap.client || {};
  const a = snap.avenant || {};

  const emAddr = [em.adresse1, em.adresse2, [em.cp, em.ville].filter(Boolean).join(' '), em.pays]
    .filter(Boolean)
    .map(esc)
    .join('<br>');

  const clAddr = [cl.adresse1, cl.adresse2, [cl.codePostal, cl.ville].filter(Boolean).join(' '), cl.pays]
    .filter(Boolean)
    .map(esc)
    .join('<br>');

  const lignes = (snap.lignes || [])
    .map(
      (l) => `<tr>
        <td class="col-desc"><div class="desc">${esc(l.designation)}</div></td>
        <td class="num col-qty">${fmt.format(l.quantite || 0)}</td>
        <td class="num col-pu">${euro(l.prixUnitaire)}</td>
        <td class="num col-amount"><span class="amount">${euro(l.montant)}</span></td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<style>
  :root{
    --ink:#15171e;--muted:#6a7180;--faint:#9aa1ad;--line:#dfe2e8;--paper:#fff;
    --accent:#7c3aed;--total-bg:#f5f3ff;
    --mono: ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;
    --sans: system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:var(--sans);color:var(--ink);line-height:1.5;-webkit-font-smoothing:antialiased}
  .accent-rule{height:4px;background:var(--accent);border-radius:4px;width:54px;margin-bottom:26px}
  .head{display:flex;justify-content:space-between;gap:30px;align-items:flex-start}
  .emitter .name{font-size:18px;font-weight:700;letter-spacing:-.01em}
  .emitter .ei{font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.04em;text-transform:uppercase;margin-top:2px}
  .emitter .block{margin-top:12px;font-size:13px;color:var(--muted);max-width:280px}
  .emitter .block .row{display:flex;gap:6px}
  .emitter .block .k{color:var(--faint);min-width:54px;font-size:12px}
  .emitter .block .v{font-family:var(--mono);font-size:12.5px;color:var(--ink)}
  .invoice-meta{text-align:right;min-width:230px}
  .invoice-meta .label{font-size:30px;font-weight:800;letter-spacing:.14em;color:var(--accent);text-transform:uppercase;line-height:1}
  .meta-grid{margin-top:18px;display:grid;grid-template-columns:auto auto;gap:6px 14px;justify-content:end;font-size:13px}
  .meta-grid .k{color:var(--muted);text-align:right}
  .meta-grid .v{font-family:var(--mono);font-size:13px;text-align:right;min-width:120px}
  .parties{display:flex;justify-content:space-between;gap:30px;margin-top:38px}
  .card{border:1px solid var(--line);border-radius:11px;padding:16px 18px;flex:1}
  .card.client{background:#fafbfc}
  .eyebrow{font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);margin-bottom:9px}
  .card .cname{font-weight:650;font-size:14.5px}
  .card .cline{font-size:13px;color:var(--muted)}
  .card .row{display:flex;gap:6px;margin-top:3px}
  .card .row .k{color:var(--faint);font-size:12px;min-width:58px}
  .card .row .v{font-family:var(--mono);font-size:12.5px}
  .origin-banner{background:#f5f3ff;border:1px solid #e9d5ff;border-radius:10px;padding:12px 16px;margin-top:20px;font-size:13px}
  .origin-banner .ref{font-family:var(--mono);font-weight:700;color:var(--accent)}
  table{width:100%;border-collapse:collapse;margin-top:24px;font-size:13.5px}
  thead th{text-align:left;font-size:10.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);padding:0 8px 9px;border-bottom:2px solid var(--ink)}
  th.num,td.num{text-align:right}
  tbody td{padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:top}
  td .desc{font-weight:550;white-space:pre-wrap}
  td .amount,td.num{font-family:var(--mono);font-variant-numeric:tabular-nums}
  td.col-desc{width:52%}
  .totals{display:flex;justify-content:flex-end;margin-top:20px}
  .totals-box{width:300px}
  .totals-box .line{display:flex;justify-content:space-between;padding:7px 2px;font-size:13.5px}
  .totals-box .line .amt{font-family:var(--mono);font-variant-numeric:tabular-nums}
  .totals-box .tva-note{font-size:11.5px;color:var(--muted);padding:4px 2px 10px;border-bottom:1px solid var(--line)}
  .totals-box .net{display:flex;justify-content:space-between;align-items:baseline;background:var(--total-bg);border:1px solid #e9d5ff;border-radius:10px;padding:13px 14px;margin-top:12px}
  .totals-box .net .lbl{font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.04em}
  .totals-box .net .amt{font-family:var(--mono);font-size:19px;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums}
  .mention{margin-top:24px;padding:12px 16px;background:#fafbfc;border:1px solid var(--line);border-radius:10px;font-size:12px;color:var(--muted);font-style:italic}
  .legal{margin-top:30px;padding-top:16px;border-top:1px solid var(--line);font-size:11px;color:var(--muted);line-height:1.6}
  .legal .tva-flag{display:inline-block;font-family:var(--mono);font-size:11.5px;color:var(--ink);background:#f0f1f4;padding:3px 8px;border-radius:6px;margin-bottom:8px}
</style></head>
<body>
  <div class="accent-rule"></div>
  <div class="head">
    <div class="emitter">
      <div class="name">${esc(em.nom)}</div>
      <div class="ei">${[em.entreprise, em.statut].filter(Boolean).map(esc).join(' · ')}</div>
      <div class="block">
        <div>${emAddr}</div>
        <div style="margin-top:8px">${row('SIRET', em.siret)}${row('APE', em.ape)}${row('Email', em.email)}${row('Tél.', em.telephone)}</div>
      </div>
    </div>
    <div class="invoice-meta">
      <div class="label">Avenant</div>
      <div class="meta-grid">
        <div class="k">N°</div><div class="v">${esc(a.numero)}</div>
        <div class="k">Date d'émission</div><div class="v">${frDate(a.dateEmission)}</div>
        ${a.devisNumero ? `<div class="k">Devis d'origine</div><div class="v">${esc(a.devisNumero)}</div>` : ''}
      </div>
    </div>
  </div>

  <div class="parties">
    <div class="card client">
      <div class="eyebrow">Avenant établi pour</div>
      <div class="cname">${esc(cl.denomination || cl.nom)}</div>
      ${cl.formeJuridique ? `<div class="cline">${esc(cl.formeJuridique)}</div>` : ''}
      <div class="cline">${clAddr}</div>
      ${cl.siren ? `<div class="row"><span class="k">SIREN</span><span class="v">${esc(cl.siren)}</span></div>` : ''}
    </div>
    <div class="card">
      <div class="eyebrow">Objet de l'avenant</div>
      ${a.objet ? `<div class="cname">${esc(a.objet)}</div>` : ''}
      ${a.description ? `<div class="cline" style="margin-top:6px;white-space:pre-wrap">${esc(a.description)}</div>` : ''}
      ${a.delaiAdd ? `<div class="cline" style="margin-top:6px">Délai additionnel : <b>${a.delaiAdd} jour(s)</b></div>` : ''}
    </div>
  </div>

  ${a.devisNumero ? `
  <div class="origin-banner">
    Le présent avenant complète le devis <span class="ref">${esc(a.devisNumero)}</span> et en fait partie intégrante.
  </div>` : ''}

  <table>
    <thead><tr>
      <th class="col-desc">Désignation</th>
      <th class="num col-qty">Qté</th>
      <th class="num col-pu">Prix unit. (€)</th>
      <th class="num col-amount">Montant (€)</th>
    </tr></thead>
    <tbody>${lignes}</tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="line"><span>Montant additionnel HT</span><span class="amt">${euro(snap.totalHt)}</span></div>
      <div class="tva-note">TVA non applicable — franchise en base (HT = TTC)</div>
      <div class="net"><span class="lbl">Net à payer</span><span class="amt">${euro(snap.totalHt)}</span></div>
    </div>
  </div>

  <div class="legal">
    <span class="tva-flag">${esc(snap.mentions?.tva || 'TVA non applicable, art. 293 B du CGI')}</span>
  </div>
</body></html>`;
}

export default { renderAvenantHtml };
