# Voice input

Transcription edits a composer draft. It does not submit an agent turn. Audio is
temporary client input, and only normal message submission sends the resulting
text.

Two transcribers implement the [transcription contract](../../packages/client-runtime/src/voice-input/transcription.ts).
Supported iPhones transcribe on the device with Apple's model. Every other client
(and iPhones without it) sends the recording to the connected environment when it
advertises `voiceTranscription` and has a dictation key configured. On-device wins
when both exist.

The [shared controller](../../packages/client-runtime/src/voice-input/controller.ts)
owns the operation while the client supplies capture and transcription. Preparation
binds the transcriber and resolved locale for the whole recording. Draft ownership,
text, and revision are captured before recording and checked before insertion, so
a late transcript cannot overwrite a draft that was edited or replaced. The web
composer stays editable while recording, so it pins only the draft owner and
inserts at the caret when the transcript arrives.

Cancellation invalidates a result immediately, but resources stay owned until the
underlying work settles. Apple's native transcription call cannot be interrupted
once started. Releasing the session or deleting its recording when the abort signal
fires would race that work. The transcription contract therefore requires
implementations to settle only after their work has stopped; the
[Apple binding](../../apps/mobile/src/native/voiceTranscription.ios.ts) checks
cancellation between native calls and discards late results.

## Environment transcription

The client mints a signed URL with `voice.createTranscriptionUrl` and POSTs the
recording to it; the response body is the transcript. The signed URL is the only
credential, so one upload path works over cookies, bearer tokens, and the relay.
The server holds the audio in memory for that request only. It is never written to
disk or kept as a chat attachment.

[`VoiceTranscription`](../../apps/server/src/voice/VoiceTranscription.ts) runs two
passes: speech-to-text biased toward the user's vocabulary, then a small language
model that removes fillers, applies spoken self-corrections, and fixes vocabulary
spellings. A failed cleanup returns the raw transcript rather than losing the
recording. Provider specifics live in
[`DictationProvider`](../../apps/server/src/voice/DictationProvider.ts); switching
providers means adding a factory there. The API key lives in the server secret
store and reaches clients only as a redaction marker, which clients read as
"configured".

## The fn key

Chromium drops fn (Globe) key events before web content or `before-input-event`
see them, so the desktop main process watches fn with an AppKit local event
monitor in [`native/fn-key`](../../native/fn-key). A local monitor needs no
Accessibility permission and only sees T3 Code's own windows. While voice input is
available it consumes bare fn presses so macOS does not also run its Globe action.
