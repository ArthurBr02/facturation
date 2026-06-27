// Placeholder resolution for templates.
//
// Templates contain {{placeholders}} like {{emetteur.siret}} or {{client.nom}}.
// This service builds the substitution map from the app settings (emetteur.*)
// plus an optional client/projet context, and substitutes them in any string.
import prisma from '../config/prisma.js';

// Maps an AppSetting key (e.g. "emetteur.siret") to its placeholder token.
function emetteurMapFromSettings(settings) {
  const map = {};
  for (const s of settings) {
    if (s.cle.startsWith('emetteur.')) {
      map[`{{${s.cle}}}`] = s.valeur ?? '';
    }
  }
  return map;
}

function frDate(date = new Date()) {
  return date.toLocaleDateString('fr-FR'); // JJ/MM/AAAA
}

/**
 * Build the full placeholder -> value map.
 * @param {{ client?: object, projet?: object, dateEmission?: Date, delaiPaiement?: number }} ctx
 */
export async function buildPlaceholderMap(ctx = {}) {
  const settings = await prisma.appSetting.findMany({ where: { groupe: { in: ['identite', 'coordonnees', 'bancaire', 'facturation'] } } });
  const emetteur = emetteurMapFromSettings(settings);

  const emission = ctx.dateEmission ? new Date(ctx.dateEmission) : new Date();
  const delai = Number(ctx.delaiPaiement ?? 30);
  const echeance = new Date(emission);
  echeance.setDate(echeance.getDate() + delai);

  const map = {
    ...emetteur,
    '{{date.emission}}': frDate(emission),
    '{{date.echeance}}': frDate(echeance),
    '{{annee}}': String(emission.getFullYear()),
  };

  if (ctx.client) {
    map['{{client.nom}}'] = ctx.client.nom ?? '';
    map['{{client.denomination}}'] = ctx.client.denomination ?? '';
    map['{{client.ville}}'] = ctx.client.ville ?? '';
  }
  if (ctx.projet) {
    map['{{projet.titre}}'] = ctx.projet.titre ?? '';
    map['{{projet.tjm}}'] = ctx.projet.tjm != null ? String(ctx.projet.tjm) : '';
  }

  return map;
}

/** Substitute all placeholders found in `text` using `map`. Unknown tokens are left as-is. */
export function resolve(text, map) {
  if (text == null) return text;
  return String(text).replace(/\{\{[^}]+\}\}/g, (token) => (token in map ? map[token] : token));
}

/** Resolve placeholders for sample/preview purposes (fake but realistic data). */
export async function buildPreviewMap() {
  return buildPlaceholderMap({
    client: { nom: 'AB Corp', denomination: 'AB Corp SAS', ville: 'Paris' },
    projet: { titre: 'Refonte e-commerce', tjm: 400 },
  });
}

export default { buildPlaceholderMap, resolve, buildPreviewMap };
