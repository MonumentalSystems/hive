'use strict';

const { v4: uuidv4 } = require('uuid');

const BOT_STATES = new Set(['listening', 'thinking', 'speaking', 'idle', 'error']);

module.exports = class BotParticipant {
    constructor(roomId, data = {}) {
        const id = data.id || `bot-${uuidv4()}`;
        const name = data.name || 'HiveVoiceBot';

        this.id = id;
        this.roomId = roomId;
        this.peer_name = name;
        this.isBot = true;
        this.createdAt = new Date().toISOString();
        this.removedAt = null;
        this.state = BOT_STATES.has(data.state) ? data.state : 'listening';
        this.muted = Boolean(data.muted);
        this.peer_audio = !this.muted;
        this.peer_video = Boolean(data.peer_video);
        this.peer_presenter = false;
        this.peer_audio_volume = 100;
        this.peer_video_privacy = false;
        this.peer_recording = false;
        this.peer_hand = false;

        this.auth = {
            controllingNpub: data.controllingNpub || '',
            allowedRoomOwnerNpubs: Array.isArray(data.allowedRoomOwnerNpubs) ? data.allowedRoomOwnerNpubs : [],
            frostGroupApproval: data.frostGroupApproval || null,
        };

        this.bridge = {
            type: data.bridge?.type || 'rtp-pcm',
            endpoint: data.bridge?.endpoint || '',
            metadata: data.bridge?.metadata || {},
        };

        this.transports = new Map();
        this.producers = new Map();
        this.consumers = new Map();

        this.telemetry = {
            joinedAt: this.createdAt,
            producerCreated: 0,
            consumerAttached: 0,
            rtpBytesIn: 0,
            rtpBytesOut: 0,
            asrLatencyMs: null,
            llmLatencyMs: null,
            ttsLatencyMs: null,
            events: [],
        };

        this.peer_info = this.buildPeerInfo();
        this.recordEvent('bot_joined');
    }

    buildPeerInfo() {
        return {
            peer_id: this.id,
            peer_uuid: this.id,
            peer_name: this.peer_name,
            peer_presenter: false,
            peer_audio: !this.muted,
            peer_audio_volume: 100,
            peer_video: this.peer_video,
            peer_video_privacy: false,
            peer_recording: false,
            peer_hand: false,
            peer_url: '',
            peer_pubkey: '',
            peer_npub: this.auth.controllingNpub,
            peer_lnaddress: '',
            peer_bot: true,
            peer_bot_state: this.state,
            peer_bot_bridge: this.bridge.type,
        };
    }

    recordEvent(type, data = {}) {
        const event = {
            ts: new Date().toISOString(),
            type,
            botId: this.id,
            roomId: this.roomId,
            ...data,
        };
        this.telemetry.events.push(event);
        if (this.telemetry.events.length > 200) this.telemetry.events.shift();
        return event;
    }

    setState(state) {
        if (!BOT_STATES.has(state)) {
            throw new Error(`Invalid bot state "${state}"`);
        }
        this.state = state;
        this.peer_info.peer_bot_state = state;
        return this.recordEvent('bot_state_changed', { state });
    }

    setMuted(muted) {
        this.muted = Boolean(muted);
        this.peer_audio = !this.muted;
        this.peer_info.peer_audio = !this.muted;
        return this.recordEvent(this.muted ? 'bot_muted' : 'bot_unmuted', { muted: this.muted });
    }

    addTransport(transport, label = 'plain') {
        this.transports.set(transport.id, { transport, label });
        transport.on('close', () => {
            this.transports.delete(transport.id);
        });
        return transport;
    }

    addProducer(producer, transport, metadata = {}) {
        this.producers.set(producer.id, producer);
        if (transport) this.addTransport(transport, `${producer.kind}-producer`);
        if (producer.kind === 'video') {
            this.peer_video = true;
            this.peer_info.peer_video = true;
        }
        if (producer.kind === 'audio') {
            this.peer_audio = !this.muted;
            this.peer_info.peer_audio = !this.muted;
        }
        this.telemetry.producerCreated += 1;
        this.recordEvent('bot_producer_created', {
            producerId: producer.id,
            kind: producer.kind,
            transportId: transport?.id,
            metadata,
        });
        producer.on('close', () => {
            this.producers.delete(producer.id);
        });
        return producer;
    }

    addConsumer(consumer, transport, metadata = {}) {
        this.consumers.set(consumer.id, consumer);
        if (transport) this.addTransport(transport, `${consumer.kind}-consumer`);
        this.telemetry.consumerAttached += 1;
        this.recordEvent('bot_consumer_attached', {
            consumerId: consumer.id,
            producerId: consumer.producerId,
            kind: consumer.kind,
            transportId: transport?.id,
            metadata,
        });
        consumer.on('close', () => {
            this.consumers.delete(consumer.id);
        });
        return consumer;
    }

    closeProducer(producerId) {
        const producer = this.producers.get(producerId);
        if (!producer) return false;
        producer.close();
        this.producers.delete(producerId);
        this.recordEvent('bot_producer_closed', { producerId });
        return true;
    }

    recordRtpIn(bytes) {
        this.telemetry.rtpBytesIn += Number(bytes) || 0;
        return this.recordEvent('bot_rtp_in', { bytes: Number(bytes) || 0 });
    }

    recordRtpOut(bytes) {
        this.telemetry.rtpBytesOut += Number(bytes) || 0;
        return this.recordEvent('bot_rtp_out', { bytes: Number(bytes) || 0 });
    }

    async refreshMediasoupStats() {
        let rtpBytesIn = 0;
        let rtpBytesOut = 0;
        let rtpPacketsIn = 0;
        let rtpPacketsOut = 0;

        for (const producer of this.producers.values()) {
            const stats = await producer.getStats().catch(() => []);
            for (const report of stats || []) {
                rtpBytesIn += Number(report.byteCount ?? report.bytesReceived ?? 0) || 0;
                rtpPacketsIn += Number(report.packetCount ?? report.packetsReceived ?? 0) || 0;
            }
        }

        for (const consumer of this.consumers.values()) {
            const stats = await consumer.getStats().catch(() => []);
            for (const report of stats || []) {
                rtpBytesOut += Number(report.byteCount ?? report.bytesSent ?? 0) || 0;
                rtpPacketsOut += Number(report.packetCount ?? report.packetsSent ?? 0) || 0;
            }
        }

        this.telemetry.rtpBytesIn = rtpBytesIn;
        this.telemetry.rtpBytesOut = rtpBytesOut;
        this.telemetry.rtpPacketsIn = rtpPacketsIn;
        this.telemetry.rtpPacketsOut = rtpPacketsOut;
        this.telemetry.lastStatsAt = new Date().toISOString();

        return {
            rtpBytesIn,
            rtpBytesOut,
            rtpPacketsIn,
            rtpPacketsOut,
            producers: this.producers.size,
            consumers: this.consumers.size,
            transports: this.transports.size,
        };
    }

    recordLatency(data = {}) {
        if (Number.isFinite(data.asrMs)) this.telemetry.asrLatencyMs = data.asrMs;
        if (Number.isFinite(data.llmMs)) this.telemetry.llmLatencyMs = data.llmMs;
        if (Number.isFinite(data.ttsMs)) this.telemetry.ttsLatencyMs = data.ttsMs;
        return this.recordEvent('bot_latency', {
            asrMs: this.telemetry.asrLatencyMs,
            llmMs: this.telemetry.llmLatencyMs,
            ttsMs: this.telemetry.ttsLatencyMs,
        });
    }

    toPeerSnapshot() {
        return {
            id: this.id,
            peer_name: this.peer_name,
            peer_info: this.peer_info,
            isBot: true,
            state: this.state,
            muted: this.muted,
            auth: this.auth,
            bridge: this.bridge,
            producerIds: Array.from(this.producers.keys()),
            consumerIds: Array.from(this.consumers.keys()),
            telemetry: this.toTelemetry(),
        };
    }

    toTelemetry() {
        return {
            ...this.telemetry,
            producers: this.producers.size,
            consumers: this.consumers.size,
            transports: this.transports.size,
            state: this.state,
            muted: this.muted,
        };
    }

    close() {
        this.removedAt = new Date().toISOString();
        this.recordEvent('bot_removed', { removedAt: this.removedAt });
        for (const producer of this.producers.values()) producer.close();
        for (const consumer of this.consumers.values()) consumer.close();
        for (const { transport } of this.transports.values()) transport.close();
        this.producers.clear();
        this.consumers.clear();
        this.transports.clear();
    }
};
