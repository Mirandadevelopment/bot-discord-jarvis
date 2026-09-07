function getAllowedGuildId() {
  return process.env.ALLOWED_GUILD_ID || process.env.GUILD_ID || null;
}

function isGuildAllowed(guildId) {
  const allowedGuildId = getAllowedGuildId();
  if (!allowedGuildId) return true;
  return guildId === allowedGuildId;
}

async function leaveDisallowedGuilds(client, logger) {
  const allowedGuildId = getAllowedGuildId();
  if (!allowedGuildId) return;

  const guilds = [...client.guilds.cache.values()];
  for (const guild of guilds) {
    if (guild.id === allowedGuildId) continue;
    try {
      await guild.leave();
      if (logger?.consoleLog) {
        logger.consoleLog("warning", `🛡️ Saindo do servidor não autorizado: ${guild.name} (${guild.id})`);
      }
    } catch (error) {
      if (logger?.consoleLog) {
        logger.consoleLog(
          "error",
          `Falha ao sair do servidor não autorizado ${guild.id}: ${error.message}`
        );
      }
    }
  }
}

module.exports = {
  getAllowedGuildId,
  isGuildAllowed,
  leaveDisallowedGuilds,
};
