const { Events } = require('discord.js');
const { _tru } = require('../utils/security-provider');

module.exports = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember) {
    await _tru(oldMember, newMember);
  }
};
