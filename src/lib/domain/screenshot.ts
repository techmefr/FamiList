/**
 * La capture jointe à un signalement de bug n'a besoin que d'être lisible, pas de rester à sa
 * résolution d'origine : une photo d'écran de téléphone pèse plusieurs mégaoctets, la migration
 * `bug_reports` plafonne la colonne à 1,5 Mo de texte base64.
 */

/** Au-delà, l'image la plus longue est redimensionnée avant l'encodage. */
export const SCREENSHOT_MAX_DIM = 1280;

/** Au-delà, on refuse le fichier avant même de le décoder : ce n'est pas une capture d'écran. */
export const SCREENSHOT_MAX_BYTES = 15 * 1024 * 1024;

/**
 * Les dimensions à donner à une image pour qu'elle tienne dans `maxDim` sur son plus grand côté,
 * sans la déformer. Une image déjà plus petite ne doit pas être agrandie — mieux vaut la garder
 * telle quelle qu'introduire du flou.
 */
export function fitWithin(width: number, height: number, maxDim: number) {
  const scale = Math.min(1, maxDim / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}
