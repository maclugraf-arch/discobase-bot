require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const DiscoBase = require('./discordClient');
const { createApp, attachRealtime } = require('./api');

const { DISCORD_TOKEN, DISCORD_GUILD_ID, API_KEY, PORT = 4001, CORS_ORIGIN = '*' } = process.env;

if (!DISCORD_TOKEN || !DISCORD_GUILD_ID) {
  console.error('Missing DISCORD_TOKEN or DISCORD_GUILD_ID in environment. See .env.example.');
  process.exit(1);
}

async function main() {
  const disco = new DiscoBase();
  console.log('Logging in to Discord...');
  await disco.start(DISCORD_TOKEN, DISCORD_GUILD_ID);
  console.log(`Connected to guild "${disco.guild.name}".`);

  const app = createApp(disco, { apiKey: API_KEY, corsOrigin: CORS_ORIGIN });
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: CORS_ORIGIN } });
  attachRealtime(io, disco);

  server.listen(PORT, () => {
    console.log(`DiscoBase API listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Fatal error starting DiscoBase:', err);
  process.exit(1);
});
