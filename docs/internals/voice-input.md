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

## Vocabulary

Words reach the models from three places, and nothing runs on a schedule:

- The user's list and the spellings learned from their fixes, stored in
  `dictation` settings. Whisper keeps only the last ~224 tokens of its prompt, so
  [`buildTranscriptionPrompt`](../../apps/server/src/voice/dictationPrompts.ts)
  trims to a budget itself and puts the most important terms last. Cleanup sees
  the whole list.
- Code identifiers and file names from the last few messages of the thread being
  dictated into, read per request. Passing names rather than the raw conversation
  keeps the prompt short and gives cleanup a list to match against, which is what
  made "use composer voice input" come back as `useComposerVoiceInput`.
- Learning happens on send. Clients remember the transcripts they inserted into a
  draft and, when it is sent,
  [`findDictationCorrections`](../../packages/client-runtime/src/voice-input/dictationCorrections.ts)
  diffs them against the sent text. The environment asks the cleanup model which
  replacements fixed a misheard name rather than rewording, and only keeps terms
  the user actually typed. Removed words move to `forgottenVocabulary` and are
  never learned again. The client owns the composer, so it needs none of the
  accessibility-based text-field watching desktop dictation apps rely on.

## The fn key

Chromium drops fn (Globe) key events before web content or `before-input-event`
see them, so the desktop main process watches fn with an AppKit local event
monitor in [`native/fn-key`](../../native/fn-key). A local monitor needs no
Accessibility permission and only sees T3 Code's own windows. While voice input is
available it consumes bare fn presses so macOS does not also run its Globe action.
