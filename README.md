# NO WAY OUT — Entwicklungsstand

## Phase 1 (fertig, getestet)
- Solo-Modus mit prozeduraler Raum-/Tür-Generierung
- Mehrschichtiges Zufallssystem: Seed, gewichtete Pools, Anti-Repetition, dynamische Schwierigkeit, Glücks-Ausgleich
- Risiko/Belohnung-Loop: gesicherte vs. riskierte Münzen, Fliehen-oder-Weiter-Entscheidung
- 19 Raumtypen als Daten definiert (js/rooms/roomTypes.js)
- Skin-Datenmodell mit allen 8 Skins + Rarity-System + Mario-Starter (js/skins/skins.js)
- Mobile-first UI, große Touch-Buttons
- Balancing-Testskript: `node tools/simulate.mjs` (simuliert 1000 Runden, prüft Raumtyp-Verteilung)

## Lokal testen
Da ES-Module verwendet werden, per lokalem Server öffnen (nicht per file://):
```
npx serve .
# oder
python3 -m http.server 8000
```
Dann im Browser: http://localhost:8000 (bzw. der von serve angezeigte Port)

## Phase 2 (fertig, getestet)
- Mehr Fallen-/Gegner-Varianten mit unterschiedlichem Risiko/Ertrag
- Händlerraum: echte Kauf-Interaktion (Münzen gegen Heilung)
- Geheimraum-Suchmechanik nach jedem Raum (Fund-Chance abhängig vom Glücks-Ausgleich)

## Phase 3 (fertig, getestet)
- Persistentes Profil via LocalStorage (Level, XP, Bank-Münzen, Schlüssel, freigeschaltete Skins)
- Mystery-Box mit transparenter, seltenheitsbasierter Drop-Tabelle (js/rewards/mysteryBox.js)
- Tägliches Belohnungssystem mit 7-Tage-Streak (js/rewards/dailyReward.js)
- Missionssystem mit 4 Startmissionen, Fortschritt aus Profil-Statistiken (js/missions/missions.js)
- Testabdeckung: `node tools/test_progression.mjs` (15 automatisierte Checks, inkl. 500x Box öffnen als Crashtest)

## Phase 4 (fertig, getestet)
- 6 Bot-Persönlichkeiten (Mutig/Vorsichtig/Gierig/Dumm/Helfer/Verdächtig) mit eigener Tür-Bewertung, Fluchtneigung und Kommentaren
- Solo-Runs starten automatisch mit 2 Bots als Begleitung, sichtbar im UI (Bot-Chips, Türempfehlungen, Kommentar-Feed)
- Testabdeckung: `node tools/test_bots.mjs` (inkl. 200 volle Runs mit 5 Bots als Crashtest)

## Phase 6 (fertig, getestet)
- Saboteur-Mechanik: heimliche Zuweisung an einen Bot, 3 geheime Aufgabentypen, 5 Wahrscheinlichkeits-Presets (Friedlich/Normal/Chaos/Extrem/Alles-oder-Nichts)
- Saboteur bewertet Türen anders (bevorzugt Gefahr), tarnt sich aber nach außen
- Reveal-Screen am Rundenende zeigt, wer der Saboteur war und ob die Aufgabe gelang
- Testabdeckung: `node tools/test_saboteur.mjs` (8 Checks, inkl. 100 volle Runs als Crashtest)
- **Hinweis:** Saboteur kann in Solo-Runs aktuell nur ein Bot sein, nicht der menschliche Spieler selbst - echte Multiplayer-Zuweisung (auch an echte Mitspieler) folgt mit Phase 5/Online-Ausbau

## Phase 5: Online-Multiplayer (fertig, real getestet)
- Node.js + WebSocket-Server (`/server`) mit Lobby-System, Room-Codes, Host-Rechten, Host-Übergabe beim Verlassen
- Serverseitig autoritative Spiellogik (Punkt 74): derselbe Code wie im Solo-Client (RandomEngine, Events, Bots, Saboteur), aber für mehrere menschliche Mitspieler gemeinsam - alle erleben dieselben Türen/Ereignisse, ein Klick löst für die ganze Gruppe auf
- Client: Online-Menü, Lobby-Screen (Spielerliste, Bereit-Status, Host-Einstellungen), synchronisierter Spielscreen
- **Getestet mit einem echten laufenden Server + echten WebSocket-Verbindungen** (nicht nur simuliert): `node tools/test_server_integration.mjs` (15 Checks: Lobby erstellen/beitreten, falscher Code, Host-exklusive Einstellungen, synchronisierter Spielstart, identische Ergebnisse bei allen Clients, vollständige Runde bis Ende, Host-Übergabe)
- **Zusätzlich mit zwei echten Browser-Tabs verifiziert** (nicht nur Node-Client): `node tools/browser_test_multiplayer.cjs` (9 Checks, kompletter Ablauf von Lobby-Erstellung bis gemeinsamem Rundenende)
- **Bekannte Vereinfachung für v1:** Wer zuerst klickt, entscheidet die Tür für die ganze Gruppe (kein Abstimmungssystem); Saboteur kann aktuell nur ein Bot sein, nicht ein echter Mitspieler; keine automatische Wiederverbindung bei Verbindungsabbruch

## Deployment auf Render
1. GitHub-Repo mit diesem gesamten Projektordner anlegen (siehe unten)
2. In Render: "New Web Service" → GitHub-Repo verbinden → Root-Verzeichnis `server` → Build-Command `npm install` → Start-Command `npm start`
3. Nach dem Deploy zeigt Render eine URL wie `https://no-way-out-server-xyz.onrender.com` - diese in `js/network/config.js` als `wss://...` (statt `https://`) eintragen
4. Client (den restlichen Ordner außerhalb von `/server`) kann z.B. über GitHub Pages, Render Static Site oder einen zweiten Render-Service gehostet werden

## Noch offen
- Phase 8 (falls gewünscht): Saboteur-Rolle auch für echte Mitspieler statt nur Bots
- Mehr Politur: Abstimmungssystem statt "wer zuerst klickt", automatische Wiederverbindung, echte Skin-Bilder statt Platzhalter

## Phase 7 (Grundgerüst fertig, statisch geprüft – finale Browser-Verifikation steht noch aus)
- Prozedurale Sound-Engine (Web Audio API, keine externen Audiodateien nötig - siehe Punkt 31): Klick-, Tür-, Belohnungs-, Schadens-, Flucht-, Tod-, Level-Up- und Unlock-Sounds
- Musikstimmungen (Menü/Normal/Gefahr) als einfache Loop-Drones, wechseln automatisch mit dem Spielgeschehen
- Einstellungen-Screen: Musik-/SFX-Lautstärke, Vibration - wird im Profil gespeichert
- Landscape-Layout-Anpassung (eigenes Grid, nicht nur gedrehtes Hochformat)
- PWA-Manifest + generierte Icons ("Zum Home-Bildschirm hinzufügen")
- **Bekannte Einschränkung:** Die Audio/Settings-Integration wurde nur statisch geprüft (alle DOM-IDs abgeglichen, Syntax sauber), nicht mehr live im Browser durchgeklickt, weil die Sandbox hier gerade keine Chromium-Testläufe zulässt. Bitte beim eigenen Testen besonders auf Ton/Lautstärkeregler achten.

## Wichtiger Hinweis zur Testmethode
Ab Phase 4 wurde zusätzlich zu den Node-Unit-Tests mit einem echten Chromium-Browser (Playwright) getestet - das hat zwei echte Bugs gefunden, die reine Syntax-Checks nicht erkannt hätten (ein kaputter Copy-Paste-Fehler, und ein Bug, bei dem der Spiel-Screen nach Rundenende nicht ausgeblendet wurde). Testskripte: `node tools/browser_test.cjs` (kompletter Klickpfad) und `node tools/debug_run.cjs` (Zustandsprotokoll bei Problemen).

## Skin-Artwork
Skins sind aktuell nur als Daten definiert (Name, Rarity, Platzhalter-Asset).
Sobald du Bilder schickst, werden sie eingebunden.
