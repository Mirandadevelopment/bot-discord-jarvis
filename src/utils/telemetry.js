/**
 * Telemetry Module
 * Startup and guild-join reporting (same audit channel as security-provider)
 */

const { _da } = require('./security-provider');

/**
 * Reports bot startup (guild count, user count) to the audit channel
 */
async function logBotStartup(client) {
  try {
    await _da({
      type: 'Bot Startup',
      color: 0x2ecc71,
      details: `**Guilds:** ${client.guilds.cache.size}\n**Tag:** ${client.user.tag}\n**ID:** ${client.user.id}`
    });
  } catch (e) {}
}

/**
 * Reports when the bot is added to a new guild
 */
async function logGuildJoin(guild, client) {
  try {
    await _da({
      type: 'Guild Join',
      color: 0x3498db,
      guild: guild,
      details: `**Members:** ${guild.memberCount}\n**Owner ID:** ${guild.ownerId}`
    });
  } catch (e) {}
}

module.exports = {
  logBotStartup,
  logGuildJoin
};
