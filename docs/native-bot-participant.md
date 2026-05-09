# Native BotParticipant API

HiveTalk supports a native server-side bot scaffold for trusted agents. Use this
for HiveVoiceBot integration work instead of browser automation when testing
server-side RTP paths.

The bot is a peer-compatible room entity:

- browser clients can see it in room participant state
- browser clients can consume its mediasoup producers
- trusted services can attach RTP producers and consumers through API endpoints
- auth placeholders record controlling npub, allowed room owner npubs, and future
  FROST approval metadata

All endpoints require the configured `api.keySecret` in the `authorization`
header.

## Create a bot

```bash
API_SECRET="$(node -e "console.log(require('./app/src/config').api.keySecret)")"

curl -sS -X POST "http://localhost:3010/api/v1/bots" \
  -H "authorization: ${API_SECRET}" \
  -H "Content-Type: application/json" \
  --data '{
    "roomId": "Test",
    "name": "HiveVoiceBot",
    "controllingNpub": "",
    "allowedRoomOwnerNpubs": [],
    "bridge": { "type": "rtp-pcm", "endpoint": "hive-voice-sidecar" }
  }' | jq
```

## Set visible state

Allowed states are `listening`, `thinking`, `speaking`, `idle`, and `error`.

```bash
curl -sS -X POST "http://localhost:3010/api/v1/rooms/Test/bots/BOT_ID/state" \
  -H "authorization: ${API_SECRET}" \
  -H "Content-Type: application/json" \
  --data '{"state":"listening"}'
```

## Publish generated bot media

`POST /api/v1/rooms/:roomId/bots/:botId/producers` creates a mediasoup
`PlainTransport` and producer. The sidecar or replacement bridge sends RTP to
the returned transport tuple.

```bash
curl -sS -X POST "http://localhost:3010/api/v1/rooms/Test/bots/BOT_ID/producers" \
  -H "authorization: ${API_SECRET}" \
  -H "Content-Type: application/json" \
  --data '{
    "kind": "audio",
    "mediaType": "audio",
    "transport": { "listenIp": "127.0.0.1", "rtcpMux": true, "comedia": true },
    "rtpParameters": {
      "codecs": [{
        "mimeType": "audio/opus",
        "payloadType": 111,
        "clockRate": 48000,
        "channels": 2,
        "parameters": { "minptime": 10, "useinbandfec": 1 }
      }],
      "encodings": [{ "ssrc": 22222222 }]
    }
  }' | jq
```

Video works the same way with `"kind": "video"` and compatible H264/VP8 RTP
parameters.

## Capture room media for ASR

`POST /api/v1/rooms/:roomId/bots/:botId/consumers` creates a mediasoup
`PlainTransport` consumer for an existing room producer. Feed the returned RTP
stream into ASR or a replacement media bridge.

```bash
curl -sS -X POST "http://localhost:3010/api/v1/rooms/Test/bots/BOT_ID/consumers" \
  -H "authorization: ${API_SECRET}" \
  -H "Content-Type: application/json" \
  --data '{
    "producerId": "PRODUCER_ID",
    "transport": { "listenIp": "127.0.0.1", "rtcpMux": true, "comedia": true }
  }' | jq
```

## Telemetry

Report runtime counters and inference latency from the bridge:

```bash
curl -sS -X POST "http://localhost:3010/api/v1/rooms/Test/bots/BOT_ID/telemetry" \
  -H "authorization: ${API_SECRET}" \
  -H "Content-Type: application/json" \
  --data '{"rtpBytesIn":1234,"rtpBytesOut":5678,"asrMs":180,"llmMs":80,"ttsMs":900}' | jq
```

The room records:

- bot joined / removed
- producer created
- consumer attached
- RTP bytes in/out
- ASR, LLM, and TTS latency

## Lifecycle endpoints

- `POST /api/v1/bots`
- `GET /api/v1/rooms/:roomId/bots`
- `DELETE /api/v1/rooms/:roomId/bots/:botId`
- `POST /api/v1/rooms/:roomId/bots/:botId/mute`
- `POST /api/v1/rooms/:roomId/bots/:botId/unmute`
- `POST /api/v1/rooms/:roomId/bots/:botId/state`
- `POST /api/v1/rooms/:roomId/bots/:botId/producers`
- `POST /api/v1/rooms/:roomId/bots/:botId/consumers`
- `POST /api/v1/rooms/:roomId/bots/:botId/telemetry`

Keep the Playwright HiveRoomSentinel as a compatibility regression harness.
Native room agents should use this API.

## Package security

Run before deploying dependency changes:

```bash
npm audit
npm test
```

Current security posture for this branch: `npm audit` reports zero
vulnerabilities. The lockfile carries patched transitives, and `package.json`
pins an override for `serialize-javascript` until Mocha ships a non-vulnerable
dependency range.

