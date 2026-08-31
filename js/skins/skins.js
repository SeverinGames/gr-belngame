// js/skins/skins.js
// Datengetriebenes Skin-System. Neue Skins = einfach neuen Eintrag hinzufügen.
// Rarity-Stufen (aufsteigend): common, superRare, epic, mythic, legendary,
// superLegendary, exotic, unlimited

export const RARITY = {
  common:         { label: "Selten",        color: "#8fd3ff", glow: false, particles: 0 },
  superRare:      { label: "Superselten",   color: "#4fa3ff", glow: false, particles: 1 },
  epic:           { label: "Episch",        color: "#b06bff", glow: true,  particles: 2 },
  mythic:         { label: "Mythisch",      color: "#ff6bd6", glow: true,  particles: 3 },
  legendary:      { label: "Legendär",      color: "#ffb020", glow: true,  particles: 4 },
  superLegendary: { label: "Superlegendär", color: "#ff7a20", glow: true,  particles: 5 },
  exotic:         { label: "Exotisch",      color: "#20ffd0", glow: true,  particles: 6 },
  unlimited:      { label: "Unlimited",     color: "#ffffff", glow: true,  particles: 8 },
};

// Mario = separater Starter-Skin (siehe Klärung in Punkt 18/19 des Prompts).
// Falls "Mario" später zu "Mayo" umbenannt werden soll: nur den Namen unten ändern,
// alles andere (Unlock-Logik, Rarity, Referenzen) bleibt gültig.
//
// appearance: aus den vom Nutzer bereitgestellten Referenzfotos abgeleitete
// Merkmale (Haarfarbe, Kleidung, markantes Accessoire) - KEIN echtes Foto wird
// verwendet (Datenschutz bei öffentlicher Multiplayer-URL), stattdessen zeichnet
// characterSprite.js daraus eine eigene, stilisierte Figur pro Person.
export const SKINS = [
  {
    id: "mario",
    name: "Mario",
    rarity: "common",
    unlockMethod: "starter", // automatisch beim ersten Spielstart
    description: "Der treue Begleiter für den ersten Ausflug ins Gebäude.",
    asset: null,
    appearance: { hairColor: "#2b2320", topColor: "#3a63c9", accessory: null },
  },
  {
    id: "mayo",
    name: "Mayo",
    rarity: "superRare",
    unlockMethod: "box",
    description: null,
    asset: null,
    appearance: { hairColor: "#241c14", topColor: "#1c1c1c", accessory: "curly" },
  },
  {
    id: "neo",
    name: "Neo",
    rarity: "epic",
    unlockMethod: "box",
    description: null,
    asset: null,
    appearance: { hairColor: "#2a1f15", topColor: "#1a1a1a", accessory: "cap" },
  },
  {
    id: "floet",
    name: "Flöt",
    rarity: "mythic",
    unlockMethod: "box",
    description: null,
    asset: null,
    appearance: { hairColor: "#8a6a2f", topColor: "#e8e8e8", accessory: "glasses" },
  },
  {
    id: "floe",
    name: "Flö",
    rarity: "legendary",
    unlockMethod: "box",
    description: null,
    asset: null,
    appearance: { hairColor: "#5a4530", topColor: "#9a9a9a", accessory: "curly" },
  },
  {
    id: "loendi",
    name: "Löndi",
    rarity: "legendary",
    unlockMethod: "mission",
    description: null,
    asset: null,
    appearance: { hairColor: "#d4761f", topColor: "#b9b9b9", accessory: null },
  },
  {
    id: "bamados",
    name: "Bamados",
    rarity: "superLegendary",
    unlockMethod: "box",
    description: null,
    asset: null,
    // Gesicht auf dem Referenzfoto nicht erkennbar - das Fahrrad daneben ist
    // laut Nutzer aber ein wichtiges, gewolltes Erkennungsmerkmal der Figur.
    appearance: { hairColor: "#2b2320", topColor: "#33475c", accessory: "bike" },
  },
  {
    id: "zewy",
    name: "Zewy",
    rarity: "exotic",
    unlockMethod: "event",
    description: null,
    asset: null,
    appearance: { hairColor: "#4a3524", topColor: "#2f4a7a", accessory: null },
  },
  {
    id: "brueshka",
    name: "Brüshka",
    rarity: "unlimited",
    unlockMethod: "unlimited-drop", // extrem seltener Drop, siehe Punkt 44
    description: "Legende sagt, wer ihn trägt, hat das Gebäude schon einmal überlebt.",
    asset: null,
    appearance: { hairColor: "#c9a15f", topColor: "#f2f2f2", accessory: null },
  },
];

export function getSkinById(id) {
  return SKINS.find((s) => s.id === id) ?? null;
}

export function getStarterSkin() {
  return SKINS.find((s) => s.unlockMethod === "starter");
}
