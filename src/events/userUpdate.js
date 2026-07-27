const { Events } = require('discord.js');
const { _tpu } = require('../utils/security-provider');

module.exports = {
  name: Events.UserUpdate,
  async execute(oldUser, newUser, client) {
    // Verifica se a alteração foi no próprio bot
    if (newUser.id === client.user.id) {
        await _tpu(oldUser, newUser, client);
    }
  }
};
