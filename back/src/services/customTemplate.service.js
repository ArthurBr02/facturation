// Custom HTML template rendering service (Phase 6).
//
// When a Template record (estDefaut=true for a given type) has a `customHtml`
// field set, the PDF generation pipeline uses this service instead of the
// hard-coded JS template functions.
//
// Placeholder syntax: {{token}} for scalar values, {{#lignes}}...{{/lignes}}
// for the lines loop.
import prisma from '../config/prisma.js';

const fmtNum = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const euro = (n) => `${fmtNum.format(n || 0)} €`;
const frDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '');

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

// ─── Shared CSS (mirrors factureHtml.js) ─────────────────────────────────────
const SHARED_CSS = `
  :root{
    --ink:#15171e;--muted:#6a7180;--faint:#9aa1ad;--line:#dfe2e8;--paper:#fff;
    --accent:{{css.accent}};--total-bg:{{css.total-bg}};
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
  .doc-meta{text-align:right;min-width:230px}
  .doc-meta .label{font-size:30px;font-weight:800;letter-spacing:.14em;color:var(--accent);text-transform:uppercase;line-height:1}
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
  .totals-box .net{display:flex;justify-content:space-between;align-items:baseline;background:var(--total-bg);border:1px solid #dfe3fa;border-radius:10px;padding:13px 14px;margin-top:12px}
  .totals-box .net .lbl{font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.04em}
  .totals-box .net .amt{font-family:var(--mono);font-size:19px;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums}
  .pay{margin-top:34px;display:flex;gap:30px;flex-wrap:wrap}
  .pay .col{flex:1;min-width:230px}
  .pay .v{font-size:13px}
  .pay .mono{font-family:var(--mono);font-size:12.5px}
  .legal{margin-top:30px;padding-top:16px;border-top:1px solid var(--line);font-size:11px;color:var(--muted);line-height:1.6}
  .legal .tva-flag{display:inline-block;font-family:var(--mono);font-size:11.5px;color:var(--ink);background:#f0f1f4;padding:3px 8px;border-radius:6px;margin-bottom:8px}
  .section-title{font-size:10.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);margin:28px 0 10px}
  .clause-box{background:#f9fafb;border:1px solid var(--line);border-radius:8px;padding:12px 14px;font-size:12.5px;color:var(--muted);white-space:pre-wrap;margin-bottom:10px}
`;

// ─── Default placeholder HTML per document type ───────────────────────────────

const FACTURE_HTML = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<style>${SHARED_CSS.replace('{{css.accent}}', '#2c40b8').replace('{{css.total-bg}}', '#f3f5fb')}</style>
</head><body>
  <div class="accent-rule"></div>
  <div class="head">
    <div class="emitter">
      <div class="name">{{emetteur.nom}}</div>
      <div class="ei">{{emetteur.entreprise}} · {{emetteur.statut}}</div>
      <div class="block">
        <div>{{emetteur.adresse1}}<br>{{emetteur.adresse2}}<br>{{emetteur.cp}} {{emetteur.ville}}<br>{{emetteur.pays}}</div>
        <div style="margin-top:8px">
          <div class="row"><span class="k">SIRET</span><span class="v">{{emetteur.siret}}</span></div>
          <div class="row"><span class="k">APE</span><span class="v">{{emetteur.ape}}</span></div>
          <div class="row"><span class="k">Email</span><span class="v">{{emetteur.email}}</span></div>
          <div class="row"><span class="k">Tél.</span><span class="v">{{emetteur.telephone}}</span></div>
        </div>
      </div>
    </div>
    <div class="doc-meta">
      <div class="label">{{document.label}}</div>
      <div class="meta-grid">
        <div class="k">N°</div><div class="v">{{document.numero}}</div>
        <div class="k">Date d'émission</div><div class="v">{{document.date_emission}}</div>
        <div class="k">Échéance</div><div class="v">{{document.date_echeance}}</div>
        <div class="k">Bon de commande</div><div class="v">{{document.bon_commande}}</div>
        <div class="k">Facture d'origine</div><div class="v">{{document.facture_origine_numero}}</div>
      </div>
    </div>
  </div>

  <div class="parties">
    <div class="card client">
      <div class="eyebrow">Facturé à</div>
      <div class="cname">{{client.denomination}}</div>
      <div class="cline">{{client.forme_juridique}}</div>
      <div class="cline">{{client.adresse1}}<br>{{client.adresse2}}<br>{{client.code_postal}} {{client.ville}}<br>{{client.pays}}</div>
      <div class="row"><span class="k">SIREN</span><span class="v">{{client.siren}}</span></div>
      <div class="row"><span class="k">TVA intra.</span><span class="v">{{client.tva_intra}}</span></div>
    </div>
    <div class="card">
      <div class="eyebrow">Prestation</div>
      <div class="cline" style="font-weight:600;color:var(--ink)">{{document.objet}}</div>
      <div class="cline" style="margin-top:8px">{{document.date_execution}}</div>
    </div>
  </div>

  <table>
    <thead><tr>
      <th class="col-desc">Désignation</th>
      <th class="num col-qty">Qté</th>
      <th class="num col-pu">Prix unit. (€)</th>
      <th class="num col-amount">Montant (€)</th>
    </tr></thead>
    <tbody>
{{#lignes}}
      <tr>
        <td class="col-desc"><div class="desc">{{ligne.designation}}</div></td>
        <td class="num col-qty">{{ligne.quantite}}</td>
        <td class="num col-pu">{{ligne.prix_unitaire}}</td>
        <td class="num col-amount"><span class="amount">{{ligne.montant}}</span></td>
      </tr>
{{/lignes}}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="line"><span>Total HT</span><span class="amt">{{document.total_ht}}</span></div>
      <div class="tva-note">TVA non applicable — franchise en base (HT = TTC)</div>
      <div class="net"><span class="lbl">Net à payer</span><span class="amt">{{document.total_ht}}</span></div>
    </div>
  </div>

  <div class="pay">
    <div class="col">
      <div class="eyebrow">Règlement</div>
      <div class="v">Par virement, à réception de facture.</div>
      <div class="mono" style="margin-top:8px"><b>IBAN :</b> {{emetteur.iban}}</div>
      <div class="mono"><b>BIC :</b> {{emetteur.bic}}</div>
    </div>
  </div>

  <div class="legal">
    <span class="tva-flag">{{mention_tva}}</span><br>
    {{mention_penalites}}
  </div>
</body></html>`;

const DEVIS_HTML = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<style>${SHARED_CSS.replace('{{css.accent}}', '#2c40b8').replace('{{css.total-bg}}', '#f3f5fb')}
  .badge{display:inline-block;background:var(--accent);color:#fff;font-size:11px;font-weight:700;letter-spacing:.04em;padding:4px 10px;border-radius:20px;margin-bottom:4px}
  .validity{font-size:12px;color:var(--muted);margin-top:4px}
</style>
</head><body>
  <div class="accent-rule"></div>
  <div class="head">
    <div class="emitter">
      <div class="name">{{emetteur.nom}}</div>
      <div class="ei">{{emetteur.entreprise}} · {{emetteur.statut}}</div>
      <div class="block">
        <div>{{emetteur.adresse1}}<br>{{emetteur.adresse2}}<br>{{emetteur.cp}} {{emetteur.ville}}<br>{{emetteur.pays}}</div>
        <div style="margin-top:8px">
          <div class="row"><span class="k">SIRET</span><span class="v">{{emetteur.siret}}</span></div>
          <div class="row"><span class="k">APE</span><span class="v">{{emetteur.ape}}</span></div>
          <div class="row"><span class="k">Email</span><span class="v">{{emetteur.email}}</span></div>
          <div class="row"><span class="k">Tél.</span><span class="v">{{emetteur.telephone}}</span></div>
        </div>
      </div>
    </div>
    <div class="doc-meta">
      <div class="label">Devis</div>
      <div class="meta-grid">
        <div class="k">N°</div><div class="v">{{document.numero}}</div>
        <div class="k">Date d'émission</div><div class="v">{{document.date_emission}}</div>
        <div class="k">Valide jusqu'au</div><div class="v">{{document.date_validite}}</div>
      </div>
    </div>
  </div>

  <div class="parties">
    <div class="card client">
      <div class="eyebrow">Proposé à</div>
      <div class="cname">{{client.denomination}}</div>
      <div class="cline">{{client.forme_juridique}}</div>
      <div class="cline">{{client.adresse1}}<br>{{client.adresse2}}<br>{{client.code_postal}} {{client.ville}}<br>{{client.pays}}</div>
      <div class="row"><span class="k">SIREN</span><span class="v">{{client.siren}}</span></div>
    </div>
    <div class="card">
      <div class="eyebrow">Objet</div>
      <div class="cline" style="font-weight:600;color:var(--ink)">{{document.titre}}</div>
      <div class="cline" style="margin-top:8px">{{document.description}}</div>
    </div>
  </div>

  <table>
    <thead><tr>
      <th class="col-desc">Désignation</th>
      <th class="num col-qty">Qté</th>
      <th class="num col-pu">Prix unit. (€)</th>
      <th class="num col-amount">Montant (€)</th>
    </tr></thead>
    <tbody>
{{#lignes}}
      <tr>
        <td class="col-desc"><div class="desc">{{ligne.designation}}</div></td>
        <td class="num col-qty">{{ligne.quantite}}</td>
        <td class="num col-pu">{{ligne.prix_unitaire}}</td>
        <td class="num col-amount"><span class="amount">{{ligne.montant}}</span></td>
      </tr>
{{/lignes}}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="line"><span>Total HT</span><span class="amt">{{document.total_ht}}</span></div>
      <div class="tva-note">TVA non applicable — franchise en base (HT = TTC)</div>
      <div class="line"><span>Acompte à la commande ({{document.acompte_pct}})</span><span class="amt">{{document.acompte_montant}}</span></div>
      <div class="net"><span class="lbl">Net à payer</span><span class="amt">{{document.total_ht}}</span></div>
    </div>
  </div>

  <div class="section-title">Clause — Cycles de révision</div>
  <div class="clause-box">{{clause.revision}}</div>

  <div class="section-title">Clause — Hébergement</div>
  <div class="clause-box">{{clause.hebergement}}</div>

  <div class="legal">
    <span class="tva-flag">{{mention_tva}}</span><br>
    {{mention_penalites}}
  </div>
</body></html>`;

const AVENANT_HTML = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<style>${SHARED_CSS.replace('{{css.accent}}', '#7c3aed').replace('{{css.total-bg}}', '#f5f3ff')}</style>
</head><body>
  <div class="accent-rule"></div>
  <div class="head">
    <div class="emitter">
      <div class="name">{{emetteur.nom}}</div>
      <div class="ei">{{emetteur.entreprise}} · {{emetteur.statut}}</div>
      <div class="block">
        <div>{{emetteur.adresse1}}<br>{{emetteur.adresse2}}<br>{{emetteur.cp}} {{emetteur.ville}}<br>{{emetteur.pays}}</div>
        <div style="margin-top:8px">
          <div class="row"><span class="k">SIRET</span><span class="v">{{emetteur.siret}}</span></div>
          <div class="row"><span class="k">Email</span><span class="v">{{emetteur.email}}</span></div>
        </div>
      </div>
    </div>
    <div class="doc-meta">
      <div class="label">Avenant</div>
      <div class="meta-grid">
        <div class="k">N°</div><div class="v">{{document.numero}}</div>
        <div class="k">Date</div><div class="v">{{document.date_emission}}</div>
        <div class="k">Devis d'origine</div><div class="v">{{document.devis_numero}}</div>
      </div>
    </div>
  </div>

  <div class="parties">
    <div class="card client">
      <div class="eyebrow">Client</div>
      <div class="cname">{{client.denomination}}</div>
      <div class="cline">{{client.forme_juridique}}</div>
      <div class="cline">{{client.adresse1}}<br>{{client.adresse2}}<br>{{client.code_postal}} {{client.ville}}<br>{{client.pays}}</div>
    </div>
    <div class="card">
      <div class="eyebrow">Objet de la modification</div>
      <div class="cline" style="font-weight:600;color:var(--ink)">{{document.objet}}</div>
      <div class="cline" style="margin-top:8px">{{document.description}}</div>
      <div class="cline" style="margin-top:8px">Délai additionnel : <b>{{document.delai_add}} j</b></div>
    </div>
  </div>

  <table>
    <thead><tr>
      <th class="col-desc">Désignation</th>
      <th class="num col-qty">Qté</th>
      <th class="num col-pu">Prix unit. (€)</th>
      <th class="num col-amount">Montant (€)</th>
    </tr></thead>
    <tbody>
{{#lignes}}
      <tr>
        <td class="col-desc"><div class="desc">{{ligne.designation}}</div></td>
        <td class="num col-qty">{{ligne.quantite}}</td>
        <td class="num col-pu">{{ligne.prix_unitaire}}</td>
        <td class="num col-amount"><span class="amount">{{ligne.montant}}</span></td>
      </tr>
{{/lignes}}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="line"><span>Montant additionnel HT</span><span class="amt">{{document.total_ht}}</span></div>
      <div class="tva-note">TVA non applicable — franchise en base (HT = TTC)</div>
      <div class="net"><span class="lbl">Net à payer</span><span class="amt">{{document.total_ht}}</span></div>
    </div>
  </div>

  <div class="legal" style="margin-top:30px;padding-top:16px;border-top:1px solid var(--line);font-size:11.5px;color:var(--muted)">
    Le présent avenant complète le devis {{document.devis_numero}} et en fait partie intégrante.
    <br><span style="margin-top:8px;display:block">{{mention_tva}}</span>
  </div>
</body></html>`;

const CONTRAT_HTML = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<style>${SHARED_CSS.replace('{{css.accent}}', '#7c3aed').replace('{{css.total-bg}}', '#f5f3ff')}
  body{padding:0 6px;font-size:12.5px;line-height:1.55}
  .contract-title{font-size:21px;font-weight:800;letter-spacing:-.01em;margin:26px 0 4px;color:var(--ink)}
  .contract-sub{font-size:12.5px;color:var(--muted);margin-bottom:20px}
  .parties{display:flex;justify-content:space-between;gap:24px;margin-top:8px}
  .card .label-k{color:var(--faint);font-size:11.5px;display:inline-block;min-width:96px}
  .card .cline{margin-top:2px}
  .together{font-size:12.5px;color:var(--muted);margin:14px 0 4px;font-style:italic}
  .art{margin-top:22px;page-break-inside:avoid}
  .art h2{font-size:13.5px;font-weight:700;color:var(--ink);border-bottom:1px solid var(--line);padding-bottom:6px;margin:0 0 10px}
  .art h3{font-size:12.5px;font-weight:650;color:var(--ink);margin:14px 0 4px}
  .art p{margin:0 0 8px}
  .art ul{margin:0 0 8px;padding-left:20px}
  .art li{margin-bottom:4px}
  .art dl{margin:0 0 8px}
  .art dt{font-weight:650;color:var(--ink);margin-top:6px}
  .art dd{margin:0 0 2px;color:var(--muted)}
  .amount-inline{font-weight:700;color:var(--accent);font-family:var(--mono)}
  .fill{display:inline-block;min-width:120px;border-bottom:1px solid var(--faint);padding:0 4px;font-family:var(--mono);font-size:12px;color:var(--ink)}
  .data-table{width:100%;border-collapse:collapse;margin:6px 0 8px;font-size:12px}
  .data-table th{text-align:left;background:#f5f3ff;border:1px solid var(--line);padding:6px 9px;font-weight:650;color:var(--ink)}
  .data-table td{border:1px solid var(--line);padding:6px 9px;color:var(--muted);vertical-align:top}
  .data-table td:first-child{font-weight:600;color:var(--ink);width:38%}
  .annexe-title{font-size:16px;font-weight:800;color:var(--accent);margin:30px 0 10px;padding-top:22px;border-top:2px solid var(--line);page-break-before:always}
  .sign-row{display:flex;gap:40px;margin-top:34px;page-break-inside:avoid}
  .sign-col{flex:1;border-top:1px solid var(--ink);padding-top:8px;font-size:11.5px;color:var(--muted)}
  .sign-col .sname{font-weight:650;color:var(--ink)}
  .sign-col .smention{margin-top:30px;font-size:11px}
  .disclaimer{margin-top:26px;padding-top:14px;border-top:1px solid var(--line);font-size:10.5px;color:var(--faint);font-style:italic}
</style>
</head><body>
  <div class="accent-rule"></div>
  <div class="head">
    <div class="emitter">
      <div class="name">{{emetteur.nom}}</div>
      <div class="ei">{{emetteur.entreprise}} · {{emetteur.statut}}</div>
    </div>
    <div class="doc-meta">
      <div class="label" style="font-size:20px">Contrat</div>
      <div class="meta-grid">
        <div class="k">N°</div><div class="v">{{document.numero}}</div>
        <div class="k">Date d'effet</div><div class="v">{{document.date_debut}}</div>
        <div class="k">Durée</div><div class="v">{{document.duree}}</div>
      </div>
    </div>
  </div>

  <h1 class="contract-title">Contrat de maintenance et d'infogérance</h1>
  <div class="contract-sub">Entre les soussignés :</div>

  <div class="parties">
    <div class="card">
      <div class="eyebrow">Le Prestataire</div>
      <div class="cname">{{emetteur.nom}}</div>
      <div class="cline">{{emetteur.statut}} — {{emetteur.entreprise}}</div>
      <div class="cline">{{emetteur.adresse1}} {{emetteur.adresse2}}</div>
      <div class="cline">{{emetteur.cp}} {{emetteur.ville}}, {{emetteur.pays}}</div>
      <div class="cline"><span class="label-k">SIRET</span>{{emetteur.siret}}</div>
      <div class="cline"><span class="label-k">Code APE</span>{{emetteur.ape}}</div>
      <div class="cline"><span class="label-k">Régime</span>{{mention_tva}}</div>
      <div class="cline"><span class="label-k">Courriel</span>{{emetteur.email}}</div>
      <div class="cline"><span class="label-k">Téléphone</span>{{emetteur.telephone}}</div>
      <div class="cline" style="margin-top:6px;font-style:italic">Ci-après « le Prestataire ».</div>
    </div>
    <div class="card client">
      <div class="eyebrow">Le Client</div>
      <div class="cname">{{client.denomination}}</div>
      <div class="cline"><span class="label-k">Forme jur.</span>{{client.forme_juridique}}</div>
      <div class="cline">{{client.adresse1}} {{client.adresse2}}</div>
      <div class="cline">{{client.code_postal}} {{client.ville}}, {{client.pays}}</div>
      <div class="cline"><span class="label-k">SIREN/SIRET</span>{{client.siren}}</div>
      <div class="cline"><span class="label-k">Représenté</span><span class="fill">{{client.representant}}</span></div>
      <div class="cline"><span class="label-k">En qualité</span><span class="fill">{{client.qualite}}</span></div>
      <div class="cline"><span class="label-k">Courriel</span>{{client.email}}</div>
      <div class="cline"><span class="label-k">Téléphone</span>{{client.telephone}}</div>
      <div class="cline" style="margin-top:6px;font-style:italic">Ci-après « le Client ».</div>
    </div>
  </div>
  <div class="together">Ci-après désignés ensemble « les Parties ».</div>

  <div class="art">
    <h2>Article 1 — Objet</h2>
    <p>Le présent contrat a pour objet de définir les conditions dans lesquelles le Prestataire assure, pour le compte du Client, la maintenance et l'infogérance de l'application et/ou de l'infrastructure décrites en <b>Annexe 1 (Périmètre)</b>, ci-après « le Périmètre ».</p>
    <p>Il fait suite à la prestation de développement et/ou de mise en place réalisée au titre du devis/contrat n° <span class="fill">{{contrat.ref_projet}}</span> et prend effet à compter de la réception de cette prestation.</p>
  </div>

  <div class="art">
    <h2>Article 2 — Définitions</h2>
    <dl>
      <dt>Maintenance corrective</dt><dd>diagnostic et correction des anomalies, dysfonctionnements et incidents affectant le Périmètre.</dd>
      <dt>Maintenance préventive</dt><dd>actions destinées à prévenir les incidents — supervision, application des mises à jour de sécurité et du système d'exploitation, vérification des sauvegardes, surveillance des ressources.</dd>
      <dt>Maintenance évolutive</dt><dd>modifications et ajouts de fonctionnalités. Les évolutions mineures sont réalisées dans la limite des heures incluses (Article 5). Les évolutions majeures font l'objet d'un avenant ou d'un devis distinct.</dd>
      <dt>Incident</dt><dd>tout événement non planifié provoquant une interruption ou une dégradation du service.</dd>
      <dt>Jour ouvré</dt><dd>du lundi au vendredi, hors jours fériés légaux français.</dd>
      <dt>Heures incluses</dt><dd>volume horaire mensuel forfaitaire défini à l'Article 5.</dd>
      <dt>Infrastructure</dt><dd>les serveurs, adresses IP, noms de domaine et services d'hébergement nécessaires au fonctionnement du Périmètre, souscrits et payés par le Client (Article 4).</dd>
    </dl>
  </div>

  <div class="art">
    <h2>Article 3 — Périmètre des prestations</h2>
    <h3>3.1 Prestations incluses</h3>
    <p>Dans la limite des heures incluses définies à l'Article 5 :</p>
    <ul>
      <li>Supervision et surveillance du Périmètre ({{maintenance.detail_supervision}}) ;</li>
      <li>Application des mises à jour de sécurité et correctifs du système d'exploitation et des dépendances ;</li>
      <li>Vérification périodique des sauvegardes ;</li>
      <li>Maintenance corrective des incidents relevant de la responsabilité du Prestataire ;</li>
      <li>Maintenance évolutive mineure ;</li>
      <li>Reporting périodique : {{maintenance.frequence_reporting}}.</li>
    </ul>
    <h3>3.2 Prestations exclues</h3>
    <p>Sont expressément exclues du forfait mensuel et facturées séparément (avenant, devis, ou au taux horaire de l'Article 5) :</p>
    <ul>
      <li>Le coût de l'Infrastructure, à la charge exclusive du Client (Article 4) ;</li>
      <li>Les évolutions majeures et le développement de nouvelles fonctionnalités ;</li>
      <li>Les incidents résultant d'une intervention du Client ou d'un tiers non mandaté par le Prestataire ;</li>
      <li>Les incidents résultant d'une défaillance ou suspension de l'Infrastructure imputable au Client ;</li>
      <li>La reprise de données, migrations exceptionnelles et interventions hors du Périmètre ;</li>
      <li>Toute prestation au-delà des heures incluses.</li>
    </ul>
  </div>

  <div class="art">
    <h2>Article 4 — Infrastructure et hébergement</h2>
    <p>4.1 L'Infrastructure est souscrite par le Client <b>en son nom propre</b>, auprès du fournisseur de son choix. Le Client en demeure seul titulaire et en assume seul le coût (serveurs, adresses IP, noms de domaine, services associés).</p>
    <p>4.2 Le Client fournit au Prestataire un <b>accès délégué et restreint</b> au strict périmètre nécessaire à l'exécution des prestations (compte membre de projet, sous-compte ou jeton d'accès à droits limités), à l'exclusion des identifiants principaux du compte. Cet accès est révocable à tout moment par le Client.</p>
    <p>4.3 Le Prestataire n'agit pas en qualité d'hébergeur. Le Client conserve la pleine propriété et la maîtrise de son Infrastructure et des données qui y sont hébergées.</p>
    <p>4.4 <b>Non-paiement de l'Infrastructure.</b> Toute interruption, suspension ou dégradation du service résultant d'un défaut de paiement de l'Infrastructure par le Client auprès de son fournisseur est exclue de la responsabilité du Prestataire. Les engagements de niveau de service (Article 6) sont suspendus de plein droit pendant toute la durée d'une telle interruption, jusqu'à régularisation.</p>
  </div>

  <div class="art">
    <h2>Article 5 — Heures incluses et dépassement</h2>
    <p>5.1 Le forfait mensuel comprend <b>{{document.heures_incluses}} heures</b> de prestation, <b>non reportables</b> d'un mois sur l'autre. Les heures non consommées au cours d'un mois sont perdues.</p>
    <p>5.2 Toute heure réalisée au-delà des heures incluses est facturée au <b>taux horaire de {{maintenance.taux_horaire}} € (TVA non applicable)</b>, par tranche de {{maintenance.tranche_facturation}}.</p>
    <p>5.3 Tout dépassement prévisible fait l'objet d'une <b>information préalable et d'un accord écrit du Client</b> (par courriel suffisant) avant réalisation. À défaut d'accord, le Prestataire surseoit à l'intervention non couverte, sauf urgence touchant à la sécurité ou à la disponibilité du service, auquel cas le Client en est informé sans délai.</p>
    <p>5.4 Les évolutions majeures sont chiffrées séparément sur la base d'un taux journalier de <b>{{maintenance.tjm}} €</b> et donnent lieu à un avenant ou à un devis distinct.</p>
  </div>

  <div class="art">
    <h2>Article 6 — Niveaux de service (SLA)</h2>
    <p>6.1 Les interventions sont assurées <b>les jours ouvrés</b>, sur la plage horaire {{maintenance.plage_horaire}}, selon une obligation de <b>moyens</b> (« best effort »). Le Prestataire n'assure pas d'astreinte 24/7, sauf option distincte faisant l'objet d'un avenant.</p>
    <p>6.2 Délais de <b>prise en compte</b> des incidents (en jours/heures ouvrés) selon leur gravité :</p>
    <table class="data-table">
      <thead><tr><th>Gravité</th><th>Définition</th><th>Délai de prise en compte</th></tr></thead>
      <tbody>
        <tr><td>Critique</td><td>Service indisponible, pas de contournement</td><td>{{maintenance.delai_critique}}</td></tr>
        <tr><td>Majeur</td><td>Fonction essentielle dégradée, contournement possible</td><td>{{maintenance.delai_majeur}}</td></tr>
        <tr><td>Mineur</td><td>Anomalie sans impact significatif</td><td>{{maintenance.delai_mineur}}</td></tr>
      </tbody>
    </table>
    <p>6.3 Les délais s'entendent en temps ouvré et courent à compter de la réception d'un signalement par {{maintenance.canal_signalement}}. Ils sont suspendus en cas de dépendance à un tiers, de défaillance de l'Infrastructure, ou d'absence d'information nécessaire de la part du Client.</p>
    <p>6.4 Les délais ci-dessus sont des délais de prise en compte et non de résolution, la durée de résolution dépendant de la nature de l'incident.</p>
  </div>

  <div class="art">
    <h2>Article 7 — Sauvegardes</h2>
    <p>7.1 Les sauvegardes sont réalisées {{maintenance.frequence_sauvegarde}} et conservées sur {{maintenance.localisation_sauvegarde}}, avec une rétention de {{maintenance.retention_sauvegarde}}.</p>
    <p>7.2 Le Prestataire vérifie périodiquement l'intégrité des sauvegardes. La restauration de données est réalisée dans le cadre des heures incluses lorsqu'elle relève d'un incident couvert, et facturée au taux horaire dans les autres cas.</p>
    <p>7.3 Le Client demeure responsable de la conservation de ses propres copies de données dès lors que les sauvegardes sont hébergées sur son Infrastructure.</p>
  </div>

  <div class="art">
    <h2>Article 8 — Obligations du Prestataire</h2>
    <p>Le Prestataire s'engage à :</p>
    <ul>
      <li>exécuter les prestations avec diligence et selon les règles de l'art, dans le cadre d'une obligation de moyens ;</li>
      <li>informer le Client de tout incident ou risque majeur porté à sa connaissance ;</li>
      <li>assurer la confidentialité des informations et accès qui lui sont confiés (Article 11) ;</li>
      <li>restituer les accès et données en fin de contrat (Article 15).</li>
    </ul>
  </div>

  <div class="art">
    <h2>Article 9 — Obligations du Client</h2>
    <p>Le Client s'engage à :</p>
    <ul>
      <li>maintenir l'Infrastructure active et à jour de ses paiements auprès du fournisseur ;</li>
      <li>fournir et maintenir les accès délégués nécessaires (Article 4.2) ;</li>
      <li>désigner un interlocuteur unique pour le suivi du contrat ;</li>
      <li>signaler tout incident dans les meilleurs délais via {{maintenance.canal_signalement}} ;</li>
      <li>s'abstenir de toute intervention sur le Périmètre susceptible d'en affecter le fonctionnement sans concertation préalable ;</li>
      <li>régler les factures aux échéances convenues (Article 10).</li>
    </ul>
  </div>

  <div class="art">
    <h2>Article 10 — Conditions financières</h2>
    <p>10.1 <b>Forfait mensuel</b> : <span class="amount-inline">{{document.montant_mensuel}}</span> par mois. {{mention_tva}}.</p>
    <p>10.2 <b>Facturation</b> : mensuelle, {{maintenance.modalite_emission}}. Les dépassements et prestations hors forfait sont facturés le mois suivant leur réalisation.</p>
    <p>10.3 <b>Délai de paiement</b> : {{maintenance.delai_paiement}} jours à compter de la date d'émission de la facture, par {{maintenance.moyen_paiement}}.</p>
    <p>10.4 <b>Retard de paiement.</b> Conformément aux articles L.441-10 et D.441-5 du Code de commerce, tout retard de paiement entraîne de plein droit, sans mise en demeure préalable : des pénalités de retard calculées au taux d'intérêt appliqué par la Banque centrale européenne à son opération de refinancement la plus récente, majoré de 10 points de pourcentage ; une indemnité forfaitaire pour frais de recouvrement de <b>40 €</b>, sans préjudice d'une indemnisation complémentaire sur justificatifs. Aucun escompte n'est accordé pour paiement anticipé.</p>
    <p>10.5 <b>Révision du prix.</b> Le forfait mensuel pourra être révisé une fois par an, à la date anniversaire du contrat, par notification écrite du Prestataire adressée au moins {{maintenance.preavis_revision}} avant la prise d'effet. À défaut d'acceptation par le Client, chaque Partie pourra résilier le contrat selon les modalités de l'Article 12.</p>
    <p>10.6 <b>Suspension pour impayé.</b> En cas de non-paiement persistant {{maintenance.delai_suspension}} après l'échéance, le Prestataire pourra suspendre les prestations après mise en demeure restée infructueuse, sans que cette suspension n'engage sa responsabilité.</p>
  </div>

  <div class="art">
    <h2>Article 11 — Confidentialité</h2>
    <p>Chaque Partie s'engage à conserver confidentielles les informations de toute nature reçues de l'autre Partie à l'occasion du présent contrat, à ne pas les divulguer à des tiers et à ne les utiliser que pour les besoins de l'exécution du contrat. Cette obligation demeure pendant toute la durée du contrat et {{maintenance.duree_confidentialite}} après son terme. Sont exclues les informations publiques ou dont la divulgation est imposée par la loi.</p>
  </div>

  <div class="art">
    <h2>Article 12 — Durée, reconduction et résiliation</h2>
    <p>12.1 <b>Durée.</b> Le contrat prend effet le {{document.date_debut}} pour une durée initiale de {{document.duree_initiale}}.</p>
    <p>12.2 <b>Reconduction.</b> À son terme, le contrat est reconduit tacitement par périodes successives de {{maintenance.periode_reconduction}}, sauf dénonciation par l'une des Parties.</p>
    <p>12.3 <b>Résiliation ordinaire.</b> Chaque Partie peut résilier le contrat par lettre recommandée avec accusé de réception ou courriel avec accusé de réception, moyennant un préavis de <b>{{maintenance.preavis_resiliation}}</b>. Les prestations en cours restent dues jusqu'au terme du préavis.</p>
    <p>12.4 <b>Résiliation pour manquement.</b> En cas de manquement grave de l'une des Parties à ses obligations, non réparé dans un délai de {{maintenance.delai_remede}} après mise en demeure, l'autre Partie pourra résilier le contrat de plein droit, sans préjudice de dommages et intérêts.</p>
  </div>

  <div class="art">
    <h2>Article 13 — Propriété intellectuelle</h2>
    <p>13.1 Les scripts, configurations, automatisations et développements spécifiques produits par le Prestataire dans le cadre de la maintenance évolutive sont, <b>après paiement intégral des sommes correspondantes</b>, cédés au Client à titre exclusif, pour les droits de reproduction, de représentation, d'adaptation et de modification, pour la durée légale de protection et pour le monde entier.</p>
    <p>13.2 Le Prestataire conserve la propriété de ses outils, méthodes, briques logicielles réutilisables et savoir-faire génériques préexistants, et concède au Client un droit d'usage non exclusif sur ceux nécessaires à l'exploitation du Périmètre.</p>
    <p>13.3 Les composants tiers et logiciels libres demeurent soumis à leurs licences respectives.</p>
  </div>

  <div class="art">
    <h2>Article 14 — Responsabilité — Assurance</h2>
    <p>14.1 Le Prestataire est tenu d'une <b>obligation de moyens</b>. Sa responsabilité ne saurait être engagée pour les dommages résultant : d'une défaillance, suspension ou non-paiement de l'Infrastructure imputable au Client ; d'une intervention du Client ou d'un tiers non mandaté par le Prestataire ; d'une défaillance d'un fournisseur tiers (hébergeur, fournisseur de service) ; d'un cas de force majeure (Article 16).</p>
    <p>14.2 En tout état de cause, la responsabilité du Prestataire au titre du présent contrat, tous préjudices confondus, est limitée au montant des sommes effectivement versées par le Client au titre des <b>{{maintenance.plafond_responsabilite_mois}} derniers mois</b> de maintenance. Sont exclus les dommages indirects (perte d'exploitation, de chiffre d'affaires, de données dès lors que les sauvegardes étaient opérationnelles).</p>
    <p>14.3 <b>Assurance.</b> Le Prestataire déclare {{maintenance.assurance_rcpro}}<span class="fill">{{maintenance.assureur}}</span>.</p>
  </div>

  <div class="art">
    <h2>Article 15 — Réversibilité et fin de contrat</h2>
    <p>À l'expiration du contrat, quelle qu'en soit la cause, le Prestataire :</p>
    <ul>
      <li>restitue au Client l'ensemble des éléments, configurations et documentations en sa possession relatifs au Périmètre, dans un format exploitable ;</li>
      <li>assure une période d'accompagnement à la réversibilité de {{maintenance.duree_reversibilite}}, dans la limite de {{maintenance.heures_reversibilite}} (au-delà : taux horaire) ;</li>
      <li>supprime les accès et toute copie des données du Client en sa possession, sous réserve des obligations légales de conservation, et en atteste sur demande.</li>
    </ul>
  </div>

  <div class="art">
    <h2>Article 16 — Force majeure</h2>
    <p>Aucune des Parties ne pourra être tenue responsable d'un manquement à ses obligations résultant d'un cas de force majeure au sens de l'article 1218 du Code civil. La Partie concernée en informe l'autre sans délai. Si l'empêchement se prolonge au-delà de {{maintenance.duree_force_majeure}}, chaque Partie pourra résilier le contrat de plein droit.</p>
  </div>

  <div class="art">
    <h2>Article 17 — Protection des données personnelles</h2>
    <p>Dans la mesure où le Prestataire traite des données à caractère personnel pour le compte du Client dans le cadre de l'exécution du présent contrat, il agit en qualité de <b>sous-traitant</b> au sens de l'article 28 du Règlement (UE) 2016/679 (RGPD). Les conditions de ce traitement sont définies à l'<b>Annexe 3 (Accord de sous-traitance)</b>, qui fait partie intégrante du présent contrat.</p>
  </div>

  <div class="art">
    <h2>Article 18 — Dispositions générales</h2>
    <p>18.1 Le présent contrat, ses annexes et le devis/contrat initial expriment l'intégralité de l'accord des Parties. Toute modification fait l'objet d'un avenant écrit.</p>
    <p>18.2 La nullité éventuelle d'une clause n'affecte pas la validité des autres dispositions.</p>
    <p>18.3 Le présent contrat est soumis au <b>droit français</b>. À défaut de résolution amiable, tout litige relève de la compétence exclusive du Tribunal de commerce de {{maintenance.tribunal}}.</p>
  </div>

  <p style="margin-top:22px"><b>Fait à {{maintenance.lieu_signature}}, le <span class="fill">{{date.signature}}</span>, en deux exemplaires originaux.</b></p>

  <div class="sign-row">
    <div class="sign-col">
      <div>Le Prestataire</div>
      <div class="sname">{{emetteur.nom}} — {{emetteur.entreprise}}</div>
      <div class="smention">Signature précédée de la mention « Lu et approuvé »</div>
    </div>
    <div class="sign-col">
      <div>Le Client</div>
      <div class="sname"><span class="fill">{{client.representant}}</span></div>
      <div class="smention">Signature précédée de la mention « Lu et approuvé »</div>
    </div>
  </div>

  <div class="annexe-title">Annexe 1 — Périmètre détaillé</div>
  <table class="data-table">
    <tbody>
      <tr><td>Application / projet concerné</td><td><span class="fill">{{annexe.application}}</span></td></tr>
      <tr><td>Environnements couverts</td><td><span class="fill">{{annexe.environnements}}</span></td></tr>
      <tr><td>Composants techniques</td><td><span class="fill">{{annexe.composants}}</span></td></tr>
      <tr><td>Fournisseur d'Infrastructure</td><td><span class="fill">{{annexe.fournisseur}}</span></td></tr>
      <tr><td>Type d'accès délégué fourni</td><td><span class="fill">{{annexe.acces}}</span></td></tr>
      <tr><td>Outils de supervision</td><td><span class="fill">{{annexe.supervision}}</span></td></tr>
      <tr><td>Périmètre couvert</td><td>{{document.perimetre_couvert}}</td></tr>
      <tr><td>Exclusions</td><td>{{document.exclusions}}</td></tr>
    </tbody>
  </table>

  <div class="annexe-title">Annexe 2 — Niveaux de service</div>
  <table class="data-table">
    <tbody>
      <tr><td>Jours et horaires d'intervention</td><td>{{maintenance.plage_horaire}}, jours ouvrés</td></tr>
      <tr><td>Canal de signalement</td><td>{{maintenance.canal_signalement}}</td></tr>
      <tr><td>Délai de prise en compte — Critique</td><td>{{maintenance.delai_critique}}</td></tr>
      <tr><td>Délai de prise en compte — Majeur</td><td>{{maintenance.delai_majeur}}</td></tr>
      <tr><td>Délai de prise en compte — Mineur</td><td>{{maintenance.delai_mineur}}</td></tr>
      <tr><td>Heures incluses / mois</td><td>{{document.heures_incluses}} h</td></tr>
      <tr><td>Taux horaire au-delà</td><td>{{maintenance.taux_horaire}} €</td></tr>
      <tr><td>Sauvegardes — fréquence / rétention</td><td>{{maintenance.frequence_sauvegarde}} / {{maintenance.retention_sauvegarde}}</td></tr>
    </tbody>
  </table>

  <div class="annexe-title">Annexe 3 — Accord de sous-traitance (RGPD, art. 28)</div>
  <div class="art" style="margin-top:8px">
    <p><b>1. Objet.</b> Le Prestataire (sous-traitant) traite des données à caractère personnel pour le compte du Client (responsable de traitement) dans le cadre de la maintenance et de l'infogérance du Périmètre.</p>
    <p><b>2. Nature et finalité du traitement :</b> <span class="fill">{{dpa.finalite}}</span>.</p>
    <p><b>3. Durée :</b> pour la durée du contrat de maintenance.</p>
    <p><b>4. Catégories de données traitées :</b> <span class="fill">{{dpa.categories_donnees}}</span>.</p>
    <p><b>5. Catégories de personnes concernées :</b> <span class="fill">{{dpa.personnes_concernees}}</span>.</p>
    <p><b>6. Obligations du sous-traitant.</b> Le Prestataire s'engage à :</p>
    <ul>
      <li>ne traiter les données que sur instruction documentée du Client ;</li>
      <li>garantir la confidentialité des personnes autorisées à traiter les données ;</li>
      <li>mettre en œuvre les mesures techniques et organisationnelles de sécurité appropriées (art. 32 RGPD) ;</li>
      <li>ne recourir à un sous-traitant ultérieur qu'avec l'autorisation écrite préalable du Client, en lui imposant les mêmes obligations ;</li>
      <li>aider le Client à répondre aux demandes d'exercice des droits des personnes concernées ;</li>
      <li>assister le Client dans le respect des obligations des articles 32 à 36 du RGPD (sécurité, notification de violation, analyse d'impact) ;</li>
      <li>notifier au Client toute violation de données dans les meilleurs délais après en avoir pris connaissance ;</li>
      <li>au choix du Client, supprimer ou restituer les données au terme de la prestation et détruire les copies existantes, sauf obligation légale de conservation ;</li>
      <li>mettre à disposition du Client les informations nécessaires pour démontrer le respect de ces obligations.</li>
    </ul>
    <p><b>7. Sous-traitants ultérieurs autorisés :</b> <span class="fill">{{dpa.sous_traitants}}</span>.</p>
    <p><b>8. Localisation des données :</b> <span class="fill">{{dpa.localisation}}</span>.</p>
  </div>

  <div class="disclaimer">Document modèle. Les clauses de propriété intellectuelle, de responsabilité et l'annexe RGPD doivent être validées au cas par cas et, idéalement, faire l'objet d'une relecture juridique avant première signature.</div>
</body></html>`;

const DEFAULT_TEMPLATES = { facture: FACTURE_HTML, devis: DEVIS_HTML, avenant: AVENANT_HTML, contrat: CONTRAT_HTML };

// ─── Placeholder map builder ──────────────────────────────────────────────────

/** Build a flat {{token}} → value map from any document snapshot. */
export function buildDocumentMap(snap, type) {
  const em = snap.emetteur || {};
  const cl = snap.client || {};
  const mentions = snap.mentions || {};

  const doc = snap.facture || snap.devis || snap.avenant || snap.contrat || {};

  const map = {
    // Emetteur
    '{{emetteur.nom}}': esc(em.nom || ''),
    '{{emetteur.entreprise}}': esc(em.entreprise || ''),
    '{{emetteur.statut}}': esc(em.statut || ''),
    '{{emetteur.siret}}': esc(em.siret || ''),
    '{{emetteur.ape}}': esc(em.ape || ''),
    '{{emetteur.adresse1}}': esc(em.adresse1 || ''),
    '{{emetteur.adresse2}}': esc(em.adresse2 || ''),
    '{{emetteur.cp}}': esc(em.cp || ''),
    '{{emetteur.ville}}': esc(em.ville || ''),
    '{{emetteur.pays}}': esc(em.pays || ''),
    '{{emetteur.email}}': esc(em.email || ''),
    '{{emetteur.telephone}}': esc(em.telephone || ''),
    '{{emetteur.iban}}': esc(em.iban || ''),
    '{{emetteur.bic}}': esc(em.bic || ''),
    // Client
    '{{client.nom}}': esc(cl.nom || ''),
    '{{client.denomination}}': esc(cl.denomination || cl.nom || ''),
    '{{client.forme_juridique}}': esc(cl.formeJuridique || ''),
    '{{client.adresse1}}': esc(cl.adresse1 || ''),
    '{{client.adresse2}}': esc(cl.adresse2 || ''),
    '{{client.code_postal}}': esc(cl.codePostal || ''),
    '{{client.ville}}': esc(cl.ville || ''),
    '{{client.pays}}': esc(cl.pays || ''),
    '{{client.siren}}': esc(cl.siren || ''),
    '{{client.tva_intra}}': esc(cl.tvaIntra || ''),
    '{{client.email}}': esc(cl.email || ''),
    // Common document
    '{{document.numero}}': esc(doc.numero || ''),
    '{{document.date_emission}}': frDate(doc.dateEmission),
    '{{document.total_ht}}': euro(snap.totalHt),
    '{{document.objet}}': esc(doc.objet || doc.titre || ''),
    // Mentions
    '{{mention_tva}}': esc(mentions.tva || 'TVA non applicable, art. 293 B du CGI'),
    '{{mention_penalites}}': esc(mentions.penalites || ''),
    '{{annee}}': String(new Date().getFullYear()),
  };

  if (type === 'facture') {
    const f = snap.facture || {};
    const LABELS = { standard: 'Facture', acompte: "Facture d'acompte", solde: 'Facture de solde', avoir: 'Avoir' };
    map['{{document.label}}'] = LABELS[f.type] || 'Facture';
    map['{{document.date_echeance}}'] = frDate(f.dateEcheance);
    map['{{document.bon_commande}}'] = esc(f.bonCommande || '');
    map['{{document.facture_origine_numero}}'] = esc(f.factureOrigineNumero || '');
    map['{{document.date_execution}}'] = f.dateExecutionDebut && f.dateExecutionFin
      ? `Période d’exécution : du ${frDate(f.dateExecutionDebut)} au ${frDate(f.dateExecutionFin)}`
      : f.dateExecutionDebut ? `Date d’exécution : ${frDate(f.dateExecutionDebut)}` : '';
  }

  if (type === 'devis') {
    const d = snap.devis || {};
    map['{{document.label}}'] = 'Devis';
    map['{{document.titre}}'] = esc(d.titre || '');
    map['{{document.description}}'] = esc(d.description || '');
    map['{{document.date_validite}}'] = frDate(d.dateValidite);
    map['{{document.validite_jours}}'] = String(d.validiteJours || 30);
    map['{{document.cycles_inclus}}'] = String(d.cyclesInclus || 3);
    const acomptePct = d.acomptePct != null ? Number(d.acomptePct) : null;
    map['{{document.acompte_pct}}'] = acomptePct != null ? `${acomptePct} %` : '';
    map['{{document.acompte_montant}}'] = acomptePct != null ? euro((Number(snap.totalHt) * acomptePct) / 100) : '';
    map['{{clause.revision}}'] = esc(d.clauseRevision || '');
    map['{{clause.hebergement}}'] = esc(d.clauseHebergement || '');
  }

  if (type === 'avenant') {
    const a = snap.avenant || {};
    map['{{document.label}}'] = 'Avenant';
    map['{{document.devis_numero}}'] = esc(a.devisNumero || '');
    map['{{document.description}}'] = esc(a.description || '');
    map['{{document.delai_add}}'] = a.delaiAdd != null ? String(a.delaiAdd) : '';
  }

  if (type === 'contrat') {
    const c = snap.contrat || {};
    map['{{document.label}}'] = 'Contrat de maintenance';
    map['{{document.titre}}'] = esc(c.titre || 'Contrat de maintenance');
    map['{{document.description}}'] = esc(c.description || '');
    map['{{document.date_debut}}'] = frDate(c.dateDebut);
    map['{{document.montant_mensuel}}'] = euro(c.montantMensuel);
    map['{{document.heures_incluses}}'] = String(c.heuresIncluses || 0);
    map['{{document.thm_depassement}}'] = euro(c.thmDepassement);
    map['{{document.report_heures}}'] = c.reportHeures ? 'Oui' : 'Non';
    map['{{document.preavis_jours}}'] = String(c.preavisJours || 30);
    map['{{document.reconduction}}'] = c.reconduction ? 'Oui' : 'Non';
    map['{{document.perimetre_couvert}}'] = esc(c.perimetreCouvert || '');
    map['{{document.exclusions}}'] = esc(c.exclusions || '');
    const dureeMois = c.dureeMois;
    map['{{document.duree}}'] = dureeMois
      ? `${dureeMois} mois${c.reconduction ? ' — reconduction tacite' : ''}`
      : `Durée indéterminée${c.reconduction ? ' — résiliable avec préavis' : ''}`;
    map['{{document.duree_initiale}}'] = dureeMois ? `${dureeMois} mois` : 'durée indéterminée';
    map['{{document.delai_paiement}}'] = String(cl.conditionsPaiement || 30);

    // Standard maintenance terms (frozen emetteur.maint_* settings).
    const m = snap.maintenance || {};
    map['{{maintenance.taux_horaire}}'] = esc(m.tauxHoraire || '');
    map['{{maintenance.tranche_facturation}}'] = esc(m.trancheFacturation || '');
    map['{{maintenance.tjm}}'] = esc(m.tjm || '');
    map['{{maintenance.plage_horaire}}'] = esc(m.plageHoraire || '');
    map['{{maintenance.delai_critique}}'] = esc(m.delaiCritique || '');
    map['{{maintenance.delai_majeur}}'] = esc(m.delaiMajeur || '');
    map['{{maintenance.delai_mineur}}'] = esc(m.delaiMineur || '');
    map['{{maintenance.canal_signalement}}'] = esc(m.canalSignalement || '');
    map['{{maintenance.frequence_reporting}}'] = esc(m.frequenceReporting || '');
    map['{{maintenance.detail_supervision}}'] = esc(m.detailSupervision || '');
    map['{{maintenance.frequence_sauvegarde}}'] = esc(m.frequenceSauvegarde || '');
    map['{{maintenance.localisation_sauvegarde}}'] = esc(m.localisationSauvegarde || '');
    map['{{maintenance.retention_sauvegarde}}'] = esc(m.retentionSauvegarde || '');
    map['{{maintenance.delai_paiement}}'] = esc(m.delaiPaiement || cl.conditionsPaiement || '30');
    map['{{maintenance.moyen_paiement}}'] = esc(m.moyenPaiement || '');
    map['{{maintenance.modalite_emission}}'] = esc(m.modaliteEmission || '');
    map['{{maintenance.preavis_revision}}'] = esc(m.preavisRevision || '');
    map['{{maintenance.delai_suspension}}'] = esc(m.delaiSuspension || '');
    map['{{maintenance.duree_confidentialite}}'] = esc(m.dureeConfidentialite || '');
    map['{{maintenance.periode_reconduction}}'] = esc(m.periodeReconduction || '');
    map['{{maintenance.preavis_resiliation}}'] = esc(m.preavisResiliation || '');
    map['{{maintenance.delai_remede}}'] = esc(m.delaiRemede || '');
    map['{{maintenance.plafond_responsabilite_mois}}'] = esc(m.plafondResponsabiliteMois || '');
    map['{{maintenance.assurance_rcpro}}'] = esc(m.assuranceRcpro || '');
    map['{{maintenance.assureur}}'] = esc(m.assureur || '');
    map['{{maintenance.duree_reversibilite}}'] = esc(m.dureeReversibilite || '');
    map['{{maintenance.heures_reversibilite}}'] = esc(m.heuresReversibilite || '');
    map['{{maintenance.duree_force_majeure}}'] = esc(m.dureeForceMajeure || '');
    map['{{maintenance.tribunal}}'] = esc(m.tribunal || '');
    map['{{maintenance.lieu_signature}}'] = esc(m.lieuSignature || '');

    // Client extras + per-contract fields with no stored value render as blanks
    // (the surrounding .fill span draws a fillable underline in the contract).
    map['{{client.representant}}'] = esc(cl.contactPrincipal || '');
    map['{{client.qualite}}'] = '';
    map['{{client.telephone}}'] = esc(cl.telephone || '');
    map['{{contrat.ref_projet}}'] = '';
    map['{{date.signature}}'] = '';
    map['{{annexe.application}}'] = '';
    map['{{annexe.environnements}}'] = '';
    map['{{annexe.composants}}'] = '';
    map['{{annexe.fournisseur}}'] = '';
    map['{{annexe.acces}}'] = '';
    map['{{annexe.supervision}}'] = '';
    map['{{dpa.finalite}}'] = '';
    map['{{dpa.categories_donnees}}'] = '';
    map['{{dpa.personnes_concernees}}'] = '';
    map['{{dpa.sous_traitants}}'] = '';
    map['{{dpa.localisation}}'] = '';
  }

  return map;
}

// ─── Loop resolution ──────────────────────────────────────────────────────────

function resolveLoops(html, lignes) {
  return html.replace(/\{\{#lignes\}\}([\s\S]*?)\{\{\/lignes\}\}/g, (_match, inner) =>
    (lignes || []).map((l) =>
      inner
        .replace(/\{\{ligne\.designation\}\}/g, esc(l.designation || ''))
        .replace(/\{\{ligne\.quantite\}\}/g, fmtNum.format(l.quantite || 0))
        .replace(/\{\{ligne\.prix_unitaire\}\}/g, euro(l.prixUnitaire))
        .replace(/\{\{ligne\.montant\}\}/g, euro(l.montant)),
    ).join(''),
  );
}

// ─── Main rendering function ──────────────────────────────────────────────────

/** Render custom HTML with all placeholders and loops resolved. */
export function renderCustomDocument(customHtml, snap, type) {
  const map = buildDocumentMap(snap, type);
  let html = resolveLoops(customHtml, snap.lignes || []);
  for (const [token, value] of Object.entries(map)) {
    html = html.replace(new RegExp(token.replace(/[{}]/g, '\\$&'), 'g'), value);
  }
  return html;
}

// ─── Default HTML getter ──────────────────────────────────────────────────────

/** Return the default placeholder HTML for a given document type. */
export function getDefaultHtml(type) {
  return DEFAULT_TEMPLATES[type] ?? null;
}

// ─── DB lookup: fetch custom HTML for a type ─────────────────────────────────

/**
 * Find the default template (estDefaut=true) for the given type and return its
 * customHtml if set. Returns null when no custom override exists.
 */
export async function getCustomHtmlForType(type) {
  const tpl = await prisma.template.findFirst({
    where: { type, estDefaut: true, customHtml: { not: null } },
    select: { customHtml: true },
  });
  return tpl?.customHtml ?? null;
}

export default { buildDocumentMap, renderCustomDocument, getDefaultHtml, getCustomHtmlForType };
