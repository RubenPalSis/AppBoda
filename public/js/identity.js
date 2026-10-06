/**
 * Alias anónimo y divertido para cada dispositivo (p. ej. "🥂 brindis_dorado").
 * Se calcula a partir del UID anónimo de Firebase: siempre es el mismo para el
 * mismo dispositivo y no contiene ningún dato personal.
 */
const EMOJIS = ["🥂", "💐", "💃", "🕺", "🎉", "✨", "🍾", "🎶", "📸", "🌸", "💍", "🍰", "🎈", "🌹", "😍", "🪩"];
const NOUNS = ["brindis", "ramo", "vals", "confeti", "anillo", "baile", "champan", "petalo", "lazo", "beso", "abrazo", "velo", "pastel", "farolillo", "girasol", "tacon"];
const ADJS = ["dorado", "alegre", "feliz", "brillante", "elegante", "bailon", "radiante", "travieso", "risueno", "chispeante", "romantico", "festivo", "magico", "sonriente", "divino", "galan"];

function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/** @returns {{emoji: string, handle: string}} */
export function aliasFor(uid) {
    const h = hash(String(uid || "?"));
    return {
        emoji: EMOJIS[h % EMOJIS.length],
        handle: `${NOUNS[(h >>> 4) % NOUNS.length]}_${ADJS[(h >>> 9) % ADJS.length]}`
    };
}

/** Número estable en [-1, 1) a partir de un texto (para la inclinación de las polaroids). */
export function jitter(str) {
    return (hash(str) % 2000) / 1000 - 1;
}
