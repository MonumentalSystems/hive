'use strict';

require('should');

const BotParticipant = require('../app/src/BotParticipant');

describe('test-BotParticipant', () => {
    it('should create a peer-compatible bot participant', () => {
        const bot = new BotParticipant('room1', {
            id: 'bot-1',
            name: 'HiveVoiceBot',
            controllingNpub: 'npub1bot',
            allowedRoomOwnerNpubs: ['npub1owner'],
        });

        bot.id.should.equal('bot-1');
        bot.isBot.should.be.true();
        bot.peer_info.peer_id.should.equal('bot-1');
        bot.peer_info.peer_bot.should.be.true();
        bot.peer_info.peer_bot_state.should.equal('listening');
        bot.peer_info.peer_npub.should.equal('npub1bot');
        bot.auth.allowedRoomOwnerNpubs.should.deepEqual(['npub1owner']);
        bot.toPeerSnapshot().producerIds.should.deepEqual([]);
    });

    it('should update mute and state telemetry', () => {
        const bot = new BotParticipant('room1', { id: 'bot-1' });

        bot.setMuted(true);
        bot.setState('speaking');
        bot.recordRtpIn(123);
        bot.recordRtpOut(456);
        bot.recordLatency({ asrMs: 10, llmMs: 20, ttsMs: 30 });

        bot.muted.should.be.true();
        bot.peer_info.peer_audio.should.be.false();
        bot.peer_info.peer_bot_state.should.equal('speaking');
        bot.toTelemetry().rtpBytesIn.should.equal(123);
        bot.toTelemetry().rtpBytesOut.should.equal(456);
        bot.toTelemetry().asrLatencyMs.should.equal(10);
        bot.toTelemetry().llmLatencyMs.should.equal(20);
        bot.toTelemetry().ttsLatencyMs.should.equal(30);
    });

    it('should reject invalid bot states', () => {
        const bot = new BotParticipant('room1', { id: 'bot-1' });

        (() => bot.setState('confused')).should.throw(/Invalid bot state/);
    });
});

