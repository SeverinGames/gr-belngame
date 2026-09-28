# Big Sevis Minispiel Party — Entwicklungsstand

Browser-Minispielsammlung. Das frühere Türen-Dungeon-System (prozedurale
Räume, HP, Risiko/Belohnung, Bots, Saboteur) wurde komplett entfernt und
durch acht eigenständige Minispiele ersetzt, die sowohl SOLO als auch ONLINE
gespielt werden.

## Lokal testen
Da ES-Module verwendet werden, per lokalem Server öffnen (nicht per file://):
```
npx serve .
# oder
python3 -m http.server 8000
```
Dann im Browser: http://localhost:8000 (bzw. der von serve angezeigte Port)

## Spielstruktur
- **SOLO**: Minispiel wählen → Schwierigkeit (Leicht/Normal/Schwer, wirkt nur
  auf die Belohnung, nicht auf die Spiellogik) → Runde spielen → Belohnung.
- **ONLINE**: Lobby per Room-Code erstellen/beitreten, Host wählt ein
  Minispiel, alle Spieler bekommen denselben Zufalls-Seed und spielen
  gleichzeitig lokal, danach Rangliste nach Punktestand (`server/`,
  WebSocket, autoritativ für Rundenabschluss).
- **SHOP**: Münzen aus Minispielen/Missionen/Daily-Streak gegen drei
  Box-Stufen eintauschen (Basic/Super/Mega, `js/shop/shop.js`) - ersetzt das
  alte Schlüssel-System vollständig.
- **SPIND**: freigeschaltete Skins verwalten und ausrüsten, wird in jedem
  Minispiel als echte Spielfigur verwendet (`js/world/characterSprite.js`).
- **MISSIONEN** und **tägliche Belohnung**: unverändert im Prinzip, geben
  jetzt ausschließlich Münzen.

## Minispiele (`js/arcade/games/`)
Obstkorb, Balloon Pop, Color Trick, Mini Memory, Reaktion, Star Catcher,
Stopp bei Grün, Schnellster Finger, Meteor Dash (Ausweichen, Leben, Game
Over), Schatzpfade (Merken + Entscheiden, Leben, Game Over). Gemeinsames Interface:
`start({ container, skinId, rng, onHud, onEnd }) -> { destroy() }`.

## Deployment auf Render (Online-Server)
1. GitHub-Repo mit diesem gesamten Projektordner anlegen
2. In Render: "New Web Service" → GitHub-Repo verbinden → Root-Verzeichnis
   `server` → Build-Command `npm install` → Start-Command `npm start`
3. Nach dem Deploy zeigt Render eine URL wie
   `https://big-sevis-server-xyz.onrender.com` - diese in
   `js/network/config.js` als `wss://...` (statt `https://`) eintragen
4. Client (der restliche Ordner außerhalb von `/server`) kann z.B. über
   GitHub Pages gehostet werden

## Bekannte Vereinfachungen
- Online-Runden haben ein serverseitiges Zeitlimit (90s) als Sicherheitsnetz,
  falls jemand die Verbindung verliert - fehlende Spieler zählen dann mit 0
  Punkten.
- Keine automatische Wiederverbindung bei Verbindungsabbruch.

## Creator Codes
Im Shop einlösbar: BIGSEVI, LÖNDI (auch LOENDI), BUSCHKA (je +250 Münzen,
einmal pro Profil/Browser - Sperre lokal im Profil). Jede Einlösung wird
zusätzlich best-effort an den Server gemeldet und dort gezählt
(`server/creatorCodeStats.js`, Datei `creator-code-stats.json`).

**Statistik für den Betreiber:** Auf Render die Umgebungsvariable `ADMIN_KEY`
setzen (langes, geheimes Passwort), dann:
`https://<dein-server>.onrender.com/admin/creator-codes?key=<ADMIN_KEY>`
liefert z.B. `{"BIGSEVI": 123}`. Ohne gesetzten `ADMIN_KEY` ist der
Endpunkt komplett gesperrt. Einschränkung: auf Render Free wird das
Dateisystem bei jedem Neu-Deploy zurückgesetzt, die Zähler starten dann
wieder bei 0 (für dauerhafte Zahlen später eine echte Datenbank anbinden).
Wer offline spielt/der Server nicht erreichbar ist, kann den Code trotzdem
einlösen - er fehlt dann nur in der globalen Statistik.
