const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const { EventEmitter } = require('events');
const store = require('./store');

const CATEGORY_NAME = 'DiscoBase';
const MAX_MESSAGE_LENGTH = 1900; // stay under Discord's 2000 char limit with margin

class DiscoBase extends EventEmitter {
  constructor() {
    super();
    this.client = new Client({ intents: [GatewayIntentBits.Guilds] });
    this.guild = null;
    this.category = null;
    this.ready = null;
  }

  async start(token, guildId) {
    this.ready = new Promise((resolve, reject) => {
      this.client.once('clientReady', async () => {
        try {
          this.guild = await this.client.guilds.fetch(guildId);
          await this.guild.channels.fetch(); // populate the cache so lookups below actually find existing channels
          this.category = await this.ensureCategory();
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      this.client.once('error', reject);
    });
    await this.client.login(token);
    await this.ready;
  }

  async ensureCategory() {
    const existing = this.guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME
    );
    if (existing) return existing;
    return this.guild.channels.create({
      name: CATEGORY_NAME,
      type: ChannelType.GuildCategory,
    });
  }

  async ensureTableChannel(table) {
    const cachedId = store.getChannelId(table);
    if (cachedId) {
      const channel = await this.guild.channels.fetch(cachedId).catch(() => null);
      if (channel) return channel;
    }

    const channelName = `db-${table}`.toLowerCase().slice(0, 90);
    const existing = this.guild.channels.cache.find(
      (c) => c.name === channelName && c.parentId === this.category.id
    );
    const channel =
      existing ||
      (await this.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: this.category.id,
        topic: `DiscoBase table: ${table}`,
      }));

    store.setChannelId(table, channel.id);
    await this.hydrateTable(table, channel);
    return channel;
  }

  // Rebuild the local index from Discord message history (e.g. after a fresh deploy
  // with an empty local disk). Discord itself stays the durable source of truth.
  async hydrateTable(table, channel) {
    let before;
    for (let i = 0; i < 20; i++) {
      const batch = await channel.messages.fetch({ limit: 100, before });
      if (batch.size === 0) break;
      for (const message of batch.values()) {
        const parsed = safeParse(message.content);
        if (parsed && parsed.key) {
          store.upsertRecord(table, parsed.key, message.id, parsed.data);
        }
      }
      before = batch.last().id;
      if (batch.size < 100) break;
    }
  }

  async setRecord(table, key, data) {
    const channel = await this.ensureTableChannel(table);
    const payload = JSON.stringify({ key, data });
    if (payload.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Record too large (${payload.length} chars, limit ${MAX_MESSAGE_LENGTH})`);
    }

    const existing = store.getRecord(table, key);
    let message;
    if (existing) {
      message = await channel.messages.fetch(existing.messageId).catch(() => null);
    }

    if (message) {
      await message.edit(payload);
      store.upsertRecord(table, key, message.id, data);
    } else {
      message = await channel.send(payload);
      store.upsertRecord(table, key, message.id, data);
    }

    const record = store.getRecord(table, key);
    this.emit('change', { table, key, action: existing ? 'update' : 'create', record });
    return record;
  }

  getRecord(table, key) {
    return store.getRecord(table, key);
  }

  listRecords(table) {
    return store.listRecords(table);
  }

  async deleteRecord(table, key) {
    const existing = store.getRecord(table, key);
    if (!existing) return false;

    const channel = await this.ensureTableChannel(table);
    const message = await channel.messages.fetch(existing.messageId).catch(() => null);
    if (message) await message.delete().catch(() => null);
    store.deleteRecord(table, key);

    this.emit('change', { table, key, action: 'delete', record: null });
    return true;
  }
}

function safeParse(content) {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

module.exports = DiscoBase;
