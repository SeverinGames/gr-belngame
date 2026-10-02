// js/progress/milestones.js
// Kleine Meilensteine: werden AUTOMATISCH vergeben (kein Abholen nötig) und
// zeigen sich als kurzer Hinweis ("Erstes Spiel heute! +40 🪙"). Sie sind
// bewusst klein - das Ziel ist, dass sich regelmäßig etwas erreicht anfühlt.
//   scope "daily": einmal pro Tag      scope "life": einmalig
import { grantRewards, ensureDaily } from "../rewards/profile.js";
import { addSpin, addMiniBoxes, addVoucher, describeRewardObj, pushEvent } from "./rewardOps.js";
import { unlockCosmetic } from "./cosmetics.js";

const S = (p) => p.stats;
export const MILESTONES = [
  // --- Tagesziele ---
  { id: "d_first", scope: "daily", label: "Erstes Spiel heute", test: (p) => p.daily.rounds >= 1, reward: { coins: 20, xp: 25 } },
  { id: "d_3", scope: "daily", label: "3 Spiele heute", test: (p) => p.daily.rounds >= 3, reward: { coins: 30, xp: 40 } },
  { id: "d_dist3", scope: "daily", label: "3 verschiedene Minispiele heute", test: (p) => p.daily.games.length >= 3, reward: { coins: 40, xp: 40 } },
  { id: "d_6", scope: "daily", label: "6 Spiele heute", test: (p) => p.daily.rounds >= 6, reward: { coins: 50, spin: 1 } },
  // --- Spiele gespielt ---
  { id: "g10", label: "10 Spiele gespielt", test: (p) => S(p).arcadeRoundsPlayed >= 10, reward: { coins: 60, xp: 40 } },
  { id: "g25", label: "25 Spiele gespielt", test: (p) => S(p).arcadeRoundsPlayed >= 25, reward: { miniBox: 1 } },
  { id: "g50", label: "50 Spiele gespielt", test: (p) => S(p).arcadeRoundsPlayed >= 50, reward: { coins: 150, cosmetic: "badge:ticket" } },
  { id: "g100", label: "100 Spiele gespielt", test: (p) => S(p).arcadeRoundsPlayed >= 100, reward: { coins: 200, spin: 1 } },
  { id: "g250", label: "250 Spiele gespielt", test: (p) => S(p).arcadeRoundsPlayed >= 250, reward: { voucher: "basic", coins: 150 } },
  { id: "g500", label: "500 Spiele gespielt", test: (p) => S(p).arcadeRoundsPlayed >= 500, reward: { coins: 500, cosmetic: "badge:trophy" } },
  // --- Vielfalt ---
  { id: "dist5", label: "5 verschiedene Minispiele gespielt", test: (p) => S(p).distinctGamesPlayed >= 5, reward: { coins: 80, xp: 60 } },
  { id: "dist8", label: "8 verschiedene Minispiele gespielt", test: (p) => S(p).distinctGamesPlayed >= 8, reward: { miniBox: 1 } },
  { id: "dist11", label: "Alle Minispiele ausprobiert", test: (p) => S(p).distinctGamesPlayed >= 14, reward: { coins: 200, cosmetic: "badge:star" } },
  // --- Highscores / Leistung ---
  { id: "perfect1", label: "Erste PERFEKT-Runde", test: (p) => S(p).perfectRounds >= 1, reward: { coins: 50, cosmetic: "badge:target" } },
  { id: "perfect10", label: "10 PERFEKT-Runden", test: (p) => S(p).perfectRounds >= 10, reward: { miniBox: 1, coins: 100 } },
  { id: "hs10", label: "10 neue Highscores", test: (p) => S(p).highscoresAchieved >= 10, reward: { coins: 100, cosmetic: "title:hunter" } },
  // --- Siege ---
  { id: "c4w3", label: "3 Siege in Vier gewinnt", test: (p) => S(p).wins_connectFour >= 3, reward: { coins: 80, xp: 60 } },
  { id: "c4w10", label: "10 Siege in Vier gewinnt", test: (p) => S(p).wins_connectFour >= 10, reward: { miniBox: 1, cosmetic: "emote:cool" } },
  { id: "c4w25", label: "25 Siege in Vier gewinnt", test: (p) => S(p).wins_connectFour >= 25, reward: { coins: 250, cosmetic: "badge:crown" } },
  // --- Party-Punkte (Summe der Bestleistungen; steigt anfangs schnell, später langsam) ---
  { id: "pp1000", label: "1.000 Party-Punkte erreicht", test: (p) => S(p).partyPoints >= 1000, reward: { coins: 60, xp: 80 } },
  { id: "pp3000", label: "3.000 Party-Punkte erreicht", test: (p) => S(p).partyPoints >= 3000, reward: { miniBox: 1 } },
  { id: "pp8000", label: "8.000 Party-Punkte erreicht", test: (p) => S(p).partyPoints >= 8000, reward: { spin: 1, coins: 100, cosmetic: "title:pro" } },
  { id: "pp15000", label: "15.000 Party-Punkte erreicht", test: (p) => S(p).partyPoints >= 15000, reward: { coins: 200, cosmetic: "frame:gold" } },
  { id: "pp25000", label: "25.000 Party-Punkte erreicht", test: (p) => S(p).partyPoints >= 25000, reward: { coins: 400, cosmetic: "effect:aurora" } },
  // --- Mais-Mission ---
  { id: "mais1", label: "Ersten Maisfeld-Schatz gefunden", test: (p) => S(p).treasuresFound >= 1, reward: { coins: 80, cosmetic: "badge:drone" } },
  { id: "mais10", label: "10 Schätze im Maisfeld", test: (p) => S(p).treasuresFound >= 10, reward: { coins: 200, cosmetic: "title:pilot" } },
  { id: "maisHard", label: "Mais-Mission SCHWER geschafft", test: (p) => (p.partyBest["maisMission|hard"] ?? 0) >= 800, reward: { coins: 250, cosmetic: "badge:corn" } },
  // --- Sammlung ---
  { id: "skins3", label: "3 Skins gesammelt", test: (p) => p.unlockedSkins.length >= 3, reward: { coins: 100, xp: 60 } },
  { id: "skins5", label: "5 Skins gesammelt", test: (p) => p.unlockedSkins.length >= 5, reward: { miniBox: 1, coins: 150 } },
  { id: "skins8", label: "Alle Skins gesammelt", test: (p) => p.unlockedSkins.length >= 8, reward: { coins: 1000, cosmetic: "frame:rainbow" } },
];

function grant(p, m) {
  const r = m.reward;
  if (r.coins || r.xp) grantRewards(p, { coins: r.coins ?? 0, xp: r.xp ?? 0 });
  if (r.spin) addSpin(p, r.spin);
  if (r.miniBox) addMiniBoxes(p, r.miniBox);
  if (r.voucher) addVoucher(p, r.voucher, 1);
  if (r.cosmetic) { const [c, id] = r.cosmetic.split(":"); unlockCosmetic(p, c, id); }
}

// Prüft alle Meilensteine; vergibt neue sofort und legt Ereignisse ab.
// Gibt die Liste der neu erreichten Meilensteine zurück.
export function checkMilestones(profile) {
  const daily = ensureDaily(profile);
  const reached = [];
  for (const m of MILESTONES) {
    const list = m.scope === "daily" ? daily.done : profile.milestonesDone;
    if (list.includes(m.id)) continue;
    if (!m.test(profile)) continue;
    list.push(m.id);
    grant(profile, m);
    const text = describeRewardObj(m.reward);
    reached.push({ id: m.id, label: m.label, text });
    pushEvent({ type: "milestone", label: m.label, text, daily: m.scope === "daily" });
  }
  return reached;
}

// Fortschritt für die Anzeige (Tagesziele im Shop/Bonus-Bereich)
export function dailyGoalsView(profile) {
  const daily = ensureDaily(profile);
  const defs = MILESTONES.filter((m) => m.scope === "daily");
  const targets = { d_first: [daily.rounds, 1], d_3: [daily.rounds, 3], d_dist3: [daily.games.length, 3], d_6: [daily.rounds, 6] };
  return defs.map((m) => ({ id: m.id, label: m.label, done: daily.done.includes(m.id), cur: Math.min(targets[m.id][0], targets[m.id][1]), max: targets[m.id][1], text: describeRewardObj(m.reward) }));
}

// Nächste erreichbare Lebens-Meilensteine (für "Als Nächstes"-Anzeige)
export function nextMilestones(profile, n = 3) {
  return MILESTONES.filter((m) => !m.scope && !profile.milestonesDone.includes(m.id)).slice(0, 40)
    .map((m) => ({ m }))
    .slice(0, n)
    .map(({ m }) => ({ id: m.id, label: m.label, text: describeRewardObj(m.reward) }));
}
