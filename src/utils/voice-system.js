const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const gTTS = require('gtts');
const path = require('path');
const fs = require('fs');
const logger = require('./system-logs');

/**
 * Sistema de Voz do Jarvis (TTS e STT)
 */
class VoiceSystem {
    constructor() {
        this.player = createAudioPlayer();
        this.tempDir = path.join(__dirname, '../../temp/voice');
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    /**
     * Converte texto em áudio e toca no canal de voz
     */
    async speak(text, channel) {
        try {
            const fileName = `voice_${Date.now()}.mp3`;
            const filePath = path.join(this.tempDir, fileName);
            
            const gtts = new gTTS(text, 'pt-br');
            
            return new Promise((resolve, reject) => {
                gtts.save(filePath, (err) => {
                    if (err) {
                        logger.consoleLog('error', `Erro ao gerar áudio: ${err.message}`);
                        return reject(err);
                    }

                    const connection = joinVoiceChannel({
                        channelId: channel.id,
                        guildId: channel.guild.id,
                        adapterCreator: channel.guild.voiceAdapterCreator,
                    });

                    const resource = createAudioResource(filePath);
                    connection.subscribe(this.player);
                    this.player.play(resource);

                    this.player.on(AudioPlayerStatus.Idle, () => {
                        // Limpa o arquivo temporário após falar
                        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                        resolve();
                    });
                });
            });
        } catch (error) {
            logger.consoleLog('error', `Erro no sistema de voz: ${error.message}`);
        }
    }

    /**
     * Transcreve áudio para texto (STT)
     * Nota: Requer processamento local ou integração.
     */
    async listen(audioStream) {
        // Implementação básica de escuta
        logger.consoleLog('info', 'IA Jarvis está ouvindo...');
        return "comando_detectado";
    }
}

module.exports = new VoiceSystem();
