// Maintenance contract HTML template, rendered server-side from a frozen snapshot.
// Visual language consistent with factureHtml.js and devisHtml.js.

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

function infoBlock(label, value) {
  if (!value && value !== 0) return '';
  return `<div class="info-row"><span class="info-label">${esc(label)}</span><span class="info-value">${esc(String(value))}</span></div>`;
}

/** Render the full HTML document for a maintenance contract snapshot. */
export function renderContratHtml(snap) {
  const em = snap.emetteur || {};
  const cl = snap.client || {};
  const c = snap.contrat || {};

  const emAddr = [em.adresse1, em.adresse2, [em.cp, em.ville].filter(Boolean).join(' '), em.pays]
    .filter(Boolean)
    .map(esc)
    .join('<br>');

  const clAddr = [cl.adresse1, cl.adresse2, [cl.codePostal, cl.ville].filter(Boolean).join(' '), cl.pays]
    .filter(Boolean)
    .map(esc)
    .join('<br>');

  const durée = c.dureeMois
    ? `${c.dureeMois} mois${c.reconduction ? ' — reconduction tacite' : ''}`
    : `Durée indéterminée${c.reconduction ? ' — résiliable avec préavis' : ''}`;

  const heuresBlock = Number(c.heuresIncluses) > 0
    ? `<div class="highlight-box">
        <div class="highlight-title">Heures incluses</div>
        <div class="highlight-value">${fmt.format(c.heuresIncluses)} h/mois</div>
        ${Number(c.thmDepassement) > 0 ? `<div class="highlight-sub">Au-delà : ${euro(c.thmDepassement)} / heure</div>` : ''}
        <div class="highlight-sub">Report d&#39;heures : ${c.reportHeures ? 'oui' : 'non (pas de report)'}</div>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<style>
  :root{
    --ink:#15171e;--muted:#6a7180;--faint:#9aa1ad;--line:#dfe2e8;--paper:#fff;
    --accent:#2c40b8;--accent2:#7c3aed;--total-bg:#f3f5fb;
    --mono: ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;
    --sans: system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  }
  *{box-sizing:border-box}
  body{margin:0;padding:20px 28px;font-family:var(--sans);color:var(--ink);line-height:1.5;-webkit-font-smoothing:antialiased}
  .accent-rule{height:4px;background:var(--accent2);border-radius:4px;width:54px;margin-bottom:26px}
  .head{display:flex;justify-content:space-between;gap:30px;align-items:flex-start}
  .emitter .name{font-size:18px;font-weight:700;letter-spacing:-.01em}
  .emitter .ei{font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.04em;text-transform:uppercase;margin-top:2px}
  .emitter .block{margin-top:12px;font-size:13px;color:var(--muted);max-width:280px}
  .emitter .block .row{display:flex;gap:6px}
  .emitter .block .k{color:var(--faint);min-width:54px;font-size:12px}
  .emitter .block .v{font-family:var(--mono);font-size:12.5px;color:var(--ink)}
  .invoice-meta{text-align:right;min-width:230px}
  .invoice-meta .label{font-size:22px;font-weight:800;letter-spacing:.08em;color:var(--accent2);text-transform:uppercase;line-height:1}
  .meta-grid{margin-top:18px;display:grid;grid-template-columns:auto auto;gap:6px 14px;justify-content:end;font-size:13px}
  .meta-grid .k{color:var(--muted);text-align:right}
  .meta-grid .v{font-family:var(--mono);font-size:13px;text-align:right;min-width:120px}
  .parties{display:flex;justify-content:space-between;gap:24px;margin-top:32px}
  .card{border:1px solid var(--line);border-radius:11px;padding:16px 18px;flex:1}
  .card.client{background:#fafbfc}
  .eyebrow{font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);margin-bottom:9px}
  .card .cname{font-weight:650;font-size:14.5px}
  .card .cline{font-size:13px;color:var(--muted)}
  .card .row{display:flex;gap:6px;margin-top:3px}
  .card .row .k{color:var(--faint);font-size:12px;min-width:58px}
  .card .row .v{font-family:var(--mono);font-size:12.5px}
  .section{margin-top:28px}
  .section-title{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);padding-bottom:8px;border-bottom:1px solid var(--line);margin-bottom:14px}
  .info-grid{display:grid;grid-template-columns:auto 1fr;gap:6px 20px}
  .info-row{display:contents}
  .info-label{font-size:12.5px;color:var(--muted);white-space:nowrap;padding:3px 0}
  .info-value{font-size:13px;color:var(--ink);font-family:var(--mono);padding:3px 0}
  .amount-box{display:flex;align-items:center;justify-content:space-between;background:var(--total-bg);border:1px solid #dfe3fa;border-radius:12px;padding:16px 20px;margin-top:20px}
  .amount-box .amount-label{font-weight:700;font-size:14px;color:var(--ink)}
  .amount-box .amount-value{font-family:var(--mono);font-size:26px;font-weight:700;color:var(--accent2)}
  .highlight-box{border-left:3px solid var(--accent2);padding:10px 14px;background:#faf5ff;border-radius:0 8px 8px 0;margin-top:14px;font-size:13px}
  .highlight-title{font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--accent2);margin-bottom:4px}
  .highlight-value{font-size:18px;font-weight:700;color:var(--ink);font-family:var(--mono)}
  .highlight-sub{font-size:12px;color:var(--muted);margin-top:3px}
  .clause-block{border-left:3px solid var(--line);padding:8px 14px;font-size:12.5px;color:var(--muted);margin-top:10px}
  .clause-block .clause-title{font-weight:700;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);margin-bottom:4px}
  .clause-text{white-space:pre-wrap;line-height:1.6}
  .legal{margin-top:30px;padding-top:16px;border-top:1px solid var(--line);font-size:11px;color:var(--muted);line-height:1.6}
  .legal .tva-flag{display:inline-block;font-family:var(--mono);font-size:11.5px;color:var(--ink);background:#f0f1f4;padding:3px 8px;border-radius:6px;margin-bottom:8px}
  .sig-block{display:flex;justify-content:space-between;gap:40px;margin-top:36px;padding-top:20px;border-top:2px solid var(--line)}
  .sig-party{flex:1}
  .sig-party .sig-label{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);margin-bottom:40px}
  .sig-party .sig-line{border-top:1px solid var(--ink);margin-top:40px;padding-top:6px;font-size:11px;color:var(--muted)}
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
      <div class="label">Contrat de maintenance</div>
      <div class="meta-grid">
        <div class="k">N°</div><div class="v">${esc(c.numero)}</div>
        <div class="k">Date de début</div><div class="v">${frDate(c.dateDebut)}</div>
        ${c.dureeMois ? `<div class="k">Durée</div><div class="v">${c.dureeMois} mois</div>` : ''}
      </div>
    </div>
  </div>

  <div class="parties">
    <div class="card client">
      <div class="eyebrow">Client</div>
      <div class="cname">${esc(cl.denomination || cl.nom)}</div>
      ${cl.formeJuridique ? `<div class="cline">${esc(cl.formeJuridique)}</div>` : ''}
      <div class="cline">${clAddr}</div>
      ${cl.siren ? `<div class="row"><span class="k">SIREN</span><span class="v">${esc(cl.siren)}</span></div>` : ''}
    </div>
    <div class="card">
      <div class="eyebrow">Objet du contrat</div>
      ${c.titre ? `<div class="cline" style="font-weight:600;color:var(--ink)">${esc(c.titre)}</div>` : ''}
      ${c.description ? `<div class="cline" style="margin-top:6px;white-space:pre-wrap;font-size:12.5px">${esc(c.description)}</div>` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Conditions financières</div>
    <div class="amount-box">
      <div class="amount-label">Montant mensuel forfaitaire</div>
      <div class="amount-value">${euro(c.montantMensuel)}</div>
    </div>
    ${heuresBlock}
  </div>

  <div class="section">
    <div class="section-title">Conditions générales</div>
    <div class="info-grid">
      ${infoBlock('Durée', durée)}
      ${infoBlock('Préavis de résiliation', `${c.preavisJours || 30} jours`)}
      ${infoBlock('Date de début', frDate(c.dateDebut))}
    </div>
  </div>

  ${c.perimetreCouvert ? `
  <div class="section">
    <div class="section-title">Périmètre couvert</div>
    <div class="clause-block">
      <div class="clause-text">${esc(c.perimetreCouvert)}</div>
    </div>
  </div>` : ''}

  ${c.exclusions ? `
  <div class="section">
    <div class="section-title">Exclusions</div>
    <div class="clause-block">
      <div class="clause-text">${esc(c.exclusions)}</div>
    </div>
  </div>` : ''}

  <div class="sig-block">
    <div class="sig-party">
      <div class="sig-label">Le prestataire</div>
      <div class="sig-line">${esc(em.nom)}</div>
    </div>
    <div class="sig-party">
      <div class="sig-label">Le client</div>
      <div class="sig-line">${esc(cl.denomination || cl.nom)}</div>
    </div>
  </div>

  <div class="legal">
    <span class="tva-flag">${esc(snap.mentions?.tva || 'TVA non applicable, art. 293 B du CGI')}</span>
  </div>
</body></html>`;
}

export default { renderContratHtml };
