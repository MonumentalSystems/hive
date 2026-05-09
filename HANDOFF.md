# HiveTalk Native BotParticipant Handoff

## Current state

This fork has a native server-side bot participant scaffold for trusted room
agents. It is being used by `MonumentalSystems/hive-voice-sidecar` to run
HiveVoiceBot without Playwright in the main media loop.

Implemented pieces:

- `BotParticipant` peer-compatible room entity
- bot create/remove/mute/unmute/state endpoints
- server-side bot `PlainTransport` producers for audio and video
- bot-side consumers for room audio capture
- room producer listing endpoint
- bot stats endpoint that refreshes mediasoup producer/consumer counters
- browser client tile handling for bot participants before/while producers arrive
- telemetry placeholders for RTP counters and ASR/LLM/TTS timing
- auth metadata placeholders for controlling npub, allowed owner npubs, and future FROST approval

## API endpoints

All endpoints require `api.keySecret` in the `authorization` header.

- `POST /api/v1/bots`
- `GET /api/v1/rooms/:roomId/bots`
- `GET /api/v1/rooms/:roomId/bots/:botId/stats`
- `GET /api/v1/rooms/:roomId/producers`
- `DELETE /api/v1/rooms/:roomId/bots/:botId`
- `POST /api/v1/rooms/:roomId/bots/:botId/mute`
- `POST /api/v1/rooms/:roomId/bots/:botId/unmute`
- `POST /api/v1/rooms/:roomId/bots/:botId/state`
- `POST /api/v1/rooms/:roomId/bots/:botId/producers`
- `POST /api/v1/rooms/:roomId/bots/:botId/consumers`
- `POST /api/v1/rooms/:roomId/bots/:botId/telemetry`

See `docs/native-bot-participant.md` for example requests.

## Live validation

Validated against the `Test` room on `hive.gnostr.cloud`:

- native bot appears as `HiveVoiceBot`
- native audio producer is consumed by browser clients
- native video producer is consumed by browser clients
- status-card VP8 RTP displays in the bot tile
- media command audio passes through the native audio producer
- sidecar can attach room audio consumers for ASR capture

The sidecar recently fixed video media switching by using ephemeral local RTP
ports for video senders. HiveTalk only needs the remote RTP to reach the
returned producer transport port.

## Known rough edges

- Bot-side room audio consumers can time out and reattach repeatedly during live
  testing. The API works, but the sidecar needs a more durable capture pump.
- Bot auth is still API-secret based with placeholders for npub/FROST policy.
- The browser sentinel remains useful as a regression harness until native bot
  soak tests are boring.

## Deployment note

The running `hive.gnostr.cloud` build used bind-mounted local `app/` and
`public/` directories during testing:

```bash
docker run -d --name mirotalksfu --restart unless-stopped --network host \
  -v /home/ms/hivetalk/hivetalksfu/app:/src/app:ro \
  -v /home/ms/hivetalk/hivetalksfu/public:/src/public:ro \
  hivetalk/sfu:latest
```

For production, bake these changes into the image or keep the bind mount
intentional and documented.

