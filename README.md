# Big Sevis Minispiel Party

Browser-Minispielsammlung mit Fortschrittssystem (XP, Level, Meilensteine, Glücksrad,
Boxen, Profil, Rangliste). Client: statische Dateien (GitHub Pages). Server: `server/`
auf Render (Online-Lobbys + Gesamt-Rangliste).

## Lokal testen
ES-Module brauchen einen lokalen Server (nicht file://):  `npx serve .`  oder  `python3 -m http.server 8000`

## Die 14 Minispiele
Obstkorb · Ballon Pop · Color Trick (echte Farbkleckse) · Mini Memory (12/16/20 Karten) · Reaktion ·
Stopp bei Grün · Schnellster Finger · Schatzpfade · Vier gewinnt · Farbröhren ·
**Mais-Mission (echtes 3D, WebGL2)** · **Farbe Nachmachen** · **Maze** · **Form Zeichnen**.
Alle mit LEICHT / MITTEL / SCHWER. Mais-Mission, Farbe Nachmachen, Maze und Form Zeichnen sind Solo-Spiele.

## Fortschritt & Belohnungen (`js/progress/`)
Ziel: ständig kleine Erfolgserlebnisse - Skins bleiben ein sehr langes Ziel.
- Runde -> Münzen + XP -> Level (Level-Up etwa alle 3-5 Runden: Münzen, Bonus-Dreh, Mini-Box, Badges, Rahmen, Titel, Emotes, Effekte).
- Meilensteine (`milestones.js`): Tagesziele + einmalige Ziele, automatisch und klein.
- Glücksrad: 1 Gratis-Dreh/Tag + erspielbare Bonus-Drehs (alle 6 Runden, max. 3/Tag; Level-Ups, Meilensteine, Daily). Vorrat max. 6.
- Mini-Box: kosmetische Bonusbox, enthält nie Skins (300 Münzen oder aus Belohnungen).
- Boxen (`js/shop/shop.js`): Basic 10.000 · Super 26.000 (ab Level 4) · Mega 55.000 (ab Level 8). Drop-Raten unverändert.
  Simulation inkl. Missionen: Freuden-Moment (Level-Up, Meilenstein, Dreh, Mission ...) im Schnitt alle ~1,2 Runden; erste gekaufte Basic Box nach ca. 40 Runden; die seltensten Skins brauchen sehr lange.
- Party-Punkte (`partyPoints.js`): Leistung (0-100 %) x Schwierigkeit (1 / 1,6 / 2,4) x 5.
  Gesamtwertung = Summe der Bestleistungen je Spiel + Schwierigkeit.
- Profil (Name, Level, Statistiken, Highscores, Sammlung, Kosmetik) und echte Rangliste (`server/leaderboard.js`).
  Ohne Server: Fehlermeldung, keine Fake-Einträge. Punkte kommen vom Gerät (nicht fälschungssicher).

## Missionen, Badges, Kosmetik, Profile
- Missionen in 4 Tabs (täglich · kurz · lang · Meilensteine, `js/missions/missions.js`); Zähler-Badges (`js/progress/badges.js`) an MISSIONEN, SHOP, GLÜCKSRAD.
- Tägliche Belohnung liegt im Shop. Kosmetik-Katalog: `js/progress/cosmetics.js` (neue Gegenstände = ein Eintrag; Abschluss-Effekte in `js/ui/effects.js`).
- Rangliste: Antippen öffnet das öffentliche Profil (`/leaderboard/profile`, nur harmlose Felder, keine Münzen/Schlüssel).
- Löndi (legendär) per Mission "32.000 Party-Punkte" (Maximum: 35.000).

## Komplett-Reset aller Spielstände
Spielstände liegen pro Gerät im Browser. Der Schlüssel `nwo_profile_v2` (`js/rewards/profile.js`) startet
jedes Gerät beim nächsten Öffnen bei null (alter Stand wird gelöscht, neuer Spielerschlüssel, Namensabfrage).
Server-Rangliste: `EPOCH` in `server/leaderboard.js`. Für einen weiteren Reset beides erhöhen.

## Anti-Missbrauch
Ergebnisse zählen nur einmal pro Spielstart; Runden unter 1,5 s oder "ungültig" geben keine Belohnung.
Reaktion: echte Reaktionszeiten nötig (unter 100 ms = Fehlstart), "HIER NICHT!" beendet das Spiel sofort.

## Tests (Playwright, Chromium)
`node tools/test_update3.cjs` (Balance, Layout aller Seiten, Badges, Missionen, Shop, Profile) und `node tools/test_party_update.cjs` (Fortschritt, Profil, Shop, Rangliste, Mobile, Reset) und
`node tools/test_new_games.cjs` (neue Spiele, Color Trick, Reaktion). Ältere Skripte in `tools/` erwarten teils alte Abläufe.

## Server (Render)
`server/` neu deployen (neu: `/leaderboard`, `/leaderboard/submit`). Server-URL: `js/network/config.js`.
