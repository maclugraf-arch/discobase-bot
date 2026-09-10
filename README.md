# DiscoBase

Discord jako baza danych: bot zapisuje rekordy jako wiadomości na dedykowanych kanałach (kategoria
`DiscoBase`, kanał `db-<table>` = "tabela"), trzyma lokalny indeks (`data/index.json`) do szybkiego
odczytu, i wystawia to na zewnątrz jako REST API + realtime (Socket.IO) — żeby np. strona na B12
mogła wyświetlać dane na żywo.

## Setup

1. **Discord Developer Portal** → New Application → Bot → skopiuj token.
   - Zakładka "Bot" → włącz nic dodatkowego nie trzeba (bot używa tylko intencji `Guilds`).
   - Zakładka "OAuth2 → URL Generator": scope `bot`, permissions: `Manage Channels`, `Send Messages`,
     `Read Message History`. Wygenerowanym linkiem zaproś bota na swój serwer.
2. Skopiuj `.env.example` do `.env` i uzupełnij:
   - `DISCORD_TOKEN` — token bota
   - `DISCORD_GUILD_ID` — ID serwera (Ustawienia serwera → Widget → ID serwera, lub prawy klik na
     serwer → "Copy Server ID")
   - `API_KEY` — dowolny sekret, wymagany do zapisu/edycji/usuwania przez REST
3. `npm install`
4. `npm start`

Bot sam utworzy kategorię `DiscoBase` i kanały `db-<table>` przy pierwszym użyciu danej tabeli.

## REST API

Odczyt jest publiczny (żeby strona mogła fetchować dane bez klucza), zapis wymaga nagłówka
`x-api-key: <API_KEY>`.

```
GET    /api/:table              lista rekordów
GET    /api/:table/:key         jeden rekord
POST   /api/:table               { key?, data }   -> tworzy (key opcjonalny, generowany jeśli brak)
PATCH  /api/:table/:key         { data }          -> scala (merge) z istniejącym
PUT    /api/:table/:key         { data }          -> zastępuje całość
DELETE /api/:table/:key
```

## Realtime (Socket.IO)

```html
<script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
<script>
  const socket = io("https://twoj-bot.onrender.com");
  socket.emit("subscribe", "leaderboard");
  socket.on("change", ({ table, key, action, record }) => {
    // odśwież UI
  });
</script>
```

To jest snippet, który wkleja się w edytorze B12 (custom code / embed HTML), żeby landing page
pokazywał dane z Discorda na żywo, bez odświeżania strony.

## Ograniczenia

- Limit ~1900 znaków na rekord (limit wiadomości Discorda).
- Rate limity Discord API — sensowne dla hobby/małych projektów, nie do dużego ruchu.
- Dane nie są szyfrowane — nie trzymaj tu haseł/danych wrażliwych.
