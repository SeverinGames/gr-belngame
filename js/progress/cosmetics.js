// js/progress/cosmetics.js
// Kosmetische Belohnungen (KEINE Skins): Badges, Titel, Rahmen, Emotes,
// Profil-Effekte. Sie sind das "Zwischendurch-Ziel" neben der Skin-Sammlung.
export const COSMETIC_CATEGORIES = {
  badge: { label: "Badges", single: "Badge" },
  title: { label: "Titel", single: "Titel" },
  frame: { label: "Rahmen", single: "Rahmen" },
  emote: { label: "Emotes", single: "Emote" },
  effect: { label: "Effekte", single: "Effekt" },
};

export const COSMETICS = {
  badge: [
    { id: "sprout", icon: "🌱", name: "Frischling" },
    { id: "clover", icon: "🍀", name: "Glückskind" },
    { id: "star", icon: "⭐", name: "Sternchen" },
    { id: "rocket", icon: "🚀", name: "Durchstarter" },
    { id: "fire", icon: "🔥", name: "Feuerkopf" },
    { id: "brain", icon: "🧠", name: "Gedächtniskünstler" },
    { id: "target", icon: "🎯", name: "Zielsicher" },
    { id: "gem", icon: "💎", name: "Edelstein" },
    { id: "crown", icon: "👑", name: "Party-König" },
    { id: "drone", icon: "🚁", name: "Maispilot" },
    { id: "corn", icon: "🌽", name: "Maisfeld-Meister" },
    { id: "trophy", icon: "🏆", name: "Rekordjäger" },
    { id: "ticket", icon: "🎟️", name: "Stammgast" },
  ],
  title: [
    { id: "newbie", name: "Neuling", free: true },
    { id: "fan", name: "Minispiel-Fan" },
    { id: "hunter", name: "Punktejäger" },
    { id: "pro", name: "Party-Profi" },
    { id: "pilot", name: "Maisfeld-Pilot" },
    { id: "lucky", name: "Glückspilz" },
    { id: "mind", name: "Meisterhirn" },
    { id: "legend", name: "Legende der Party" },
  ],
  frame: [
    { id: "none", name: "Kein Rahmen", free: true },
    { id: "bronze", name: "Bronze-Rahmen" },
    { id: "silver", name: "Silber-Rahmen" },
    { id: "gold", name: "Gold-Rahmen" },
    { id: "neon", name: "Neon-Rahmen" },
    { id: "rainbow", name: "Regenbogen-Rahmen" },
  ],
  emote: [
    { id: "cool", icon: "😎", name: "Cool" },
    { id: "party", icon: "🥳", name: "Party" },
    { id: "wow", icon: "🤩", name: "Wow" },
    { id: "devil", icon: "😈", name: "Frech" },
    { id: "unicorn", icon: "🦄", name: "Einhorn" },
    { id: "mind", icon: "🤯", name: "Kopf explodiert" },
  ],
  effect: [
    { id: "none", name: "Kein Effekt", free: true },
    { id: "sparkle", icon: "✨", name: "Funkeln" },
    { id: "pulse", icon: "💠", name: "Puls-Glow" },
    { id: "aurora", icon: "🌈", name: "Aurora" },
  ],
};

export const key = (cat, id) => `${cat}:${id}`;
export function getCosmetic(cat, id) { return (COSMETICS[cat] ?? []).find((c) => c.id === id) ?? null; }
export function allCosmeticKeys() {
  return Object.entries(COSMETICS).flatMap(([cat, list]) => list.filter((c) => !c.free).map((c) => key(cat, c.id)));
}
export function ensureCosmetics(profile) {
  if (!profile.cosmetics) profile.cosmetics = { owned: [], equipped: {} };
  if (!Array.isArray(profile.cosmetics.owned)) profile.cosmetics.owned = [];
  if (!profile.cosmetics.equipped) profile.cosmetics.equipped = {};
  return profile.cosmetics;
}
export function ownsCosmetic(profile, cat, id) {
  const c = getCosmetic(cat, id);
  if (!c) return false;
  if (c.free) return true;
  return ensureCosmetics(profile).owned.includes(key(cat, id));
}
// true = neu freigeschaltet, false = hatte man schon / unbekannt
export function unlockCosmetic(profile, cat, id) {
  const c = getCosmetic(cat, id);
  if (!c || c.free) return false;
  const cs = ensureCosmetics(profile);
  const k = key(cat, id);
  if (cs.owned.includes(k)) return false;
  cs.owned.push(k);
  // Erster Fund pro Kategorie wird automatisch ausgerüstet - sofort sichtbarer Effekt.
  if (!cs.equipped[cat]) cs.equipped[cat] = id;
  return true;
}
export function equipCosmetic(profile, cat, id) {
  if (!ownsCosmetic(profile, cat, id)) return false;
  ensureCosmetics(profile).equipped[cat] = id;
  return true;
}
export function equippedCosmetic(profile, cat) {
  const id = ensureCosmetics(profile).equipped[cat];
  const fallback = cat === "title" ? "newbie" : (cat === "frame" || cat === "effect") ? "none" : null;
  const use = id && ownsCosmetic(profile, cat, id) ? id : fallback;
  return use ? getCosmetic(cat, use) : null;
}
// Zufällige, noch nicht besessene Kosmetik (für Mini-Box / Glücksrad)
export function randomUnownedCosmetic(profile, rng = Math.random) {
  const cs = ensureCosmetics(profile);
  const left = allCosmeticKeys().filter((k) => !cs.owned.includes(k));
  if (!left.length) return null;
  const k = left[Math.floor(rng() * left.length)];
  const [cat, id] = k.split(":");
  return { cat, id, cosmetic: getCosmetic(cat, id) };
}
export function cosmeticLabel(cat, id) {
  const c = getCosmetic(cat, id);
  if (!c) return "";
  return `${COSMETIC_CATEGORIES[cat].single}: ${c.icon ? c.icon + " " : ""}${c.name}`;
}
export function cosmeticCounts(profile) {
  const keys = allCosmeticKeys();
  const owned = ensureCosmetics(profile).owned.filter((k) => keys.includes(k)).length;
  return { owned, total: keys.length };
}
