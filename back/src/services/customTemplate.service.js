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
  .info-block{background:#f9fafb;border:1px solid var(--line);border-radius:8px;padding:14px 16px;margin-top:18px}
  .info-block h4{font-size:10.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);margin:0 0 10px}
  .info-row{display:flex;gap:8px;margin-bottom:6px;font-size:13px}
  .info-label{color:var(--muted);min-width:160px;font-size:12.5px}
  .info-value{font-family:var(--mono);font-size:12.5px;color:var(--ink)}
  .highlight-box{background:var(--total-bg);border:1px solid #c4b5fd;border-radius:10px;padding:14px 16px;margin-top:14px}
  .highlight-title{font-size:10.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);margin-bottom:6px}
  .highlight-value{font-family:var(--mono);font-size:22px;font-weight:700;color:var(--accent)}
  .highlight-sub{font-size:12px;color:var(--muted);margin-top:4px}
  .sign-row{display:flex;gap:40px;margin-top:50px}
  .sign-col{flex:1;border-top:1px solid var(--line);padding-top:10px;font-size:12px;color:var(--muted)}
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
          <div class="row"><span class="k">Email</span><span class="v">{{emetteur.email}}</span></div>
        </div>
      </div>
    </div>
    <div class="doc-meta">
      <div class="label">Contrat</div>
      <div class="meta-grid">
        <div class="k">N°</div><div class="v">{{document.numero}}</div>
        <div class="k">Date de début</div><div class="v">{{document.date_debut}}</div>
        <div class="k">Durée</div><div class="v">{{document.duree}}</div>
      </div>
    </div>
  </div>

  <div class="parties">
    <div class="card client">
      <div class="eyebrow">Client</div>
      <div class="cname">{{client.denomination}}</div>
      <div class="cline">{{client.forme_juridique}}</div>
      <div class="cline">{{client.adresse1}}<br>{{client.adresse2}}<br>{{client.code_postal}} {{client.ville}}<br>{{client.pays}}</div>
      <div class="row"><span class="k">SIREN</span><span class="v">{{client.siren}}</span></div>
    </div>
    <div class="card">
      <div class="eyebrow">Objet du contrat</div>
      <div class="cline" style="font-weight:600;color:var(--ink)">{{document.titre}}</div>
      <div class="cline" style="margin-top:8px">{{document.description}}</div>
    </div>
  </div>

  <div class="info-block">
    <h4>Tarification</h4>
    <div class="info-row"><span class="info-label">Montant mensuel fixe</span><span class="info-value">{{document.montant_mensuel}}</span></div>
    <div class="info-row"><span class="info-label">Heures incluses / mois</span><span class="info-value">{{document.heures_incluses}} h</span></div>
    <div class="info-row"><span class="info-label">Taux horaire dépassement</span><span class="info-value">{{document.thm_depassement}} / h</span></div>
    <div class="info-row"><span class="info-label">Report d'heures</span><span class="info-value">{{document.report_heures}}</span></div>
  </div>

  <div class="info-block">
    <h4>Conditions contractuelles</h4>
    <div class="info-row"><span class="info-label">Durée du contrat</span><span class="info-value">{{document.duree}}</span></div>
    <div class="info-row"><span class="info-label">Reconduction tacite</span><span class="info-value">{{document.reconduction}}</span></div>
    <div class="info-row"><span class="info-label">Préavis de résiliation</span><span class="info-value">{{document.preavis_jours}} jours</span></div>
  </div>

  <div class="info-block" style="margin-top:14px">
    <h4>Périmètre couvert</h4>
    <div style="font-size:13px;color:var(--muted)">{{document.perimetre_couvert}}</div>
  </div>

  <div class="info-block" style="margin-top:14px">
    <h4>Exclusions</h4>
    <div style="font-size:13px;color:var(--muted)">{{document.exclusions}}</div>
  </div>

  <div class="sign-row">
    <div class="sign-col">Signature du prestataire<br><br>{{emetteur.nom}}</div>
    <div class="sign-col">Signature du client<br><br>{{client.denomination}}</div>
  </div>

  <div class="legal" style="margin-top:30px;padding-top:16px;border-top:1px solid var(--line);font-size:11px;color:var(--muted)">
    <span class="tva-flag">{{mention_tva}}</span>
  </div>
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
