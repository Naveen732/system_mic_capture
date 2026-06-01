import * as sdk from 'microsoft-cognitiveservices-speech-sdk'

export class AzureSpeechService {
  private pushStream: sdk.PushAudioInputStream | null = null
  private recognizer: sdk.SpeechRecognizer | null = null

  public onRecognizing?: (text: string) => void
  public onRecognized?: (text: string) => void

  constructor(
    private subscriptionKey: string,
    private serviceRegion: string,
    private endpoint?: string
  ) {}

  start() {
    let speechConfig: sdk.SpeechConfig

    if (this.endpoint && this.endpoint.startsWith('http')) {
      speechConfig = sdk.SpeechConfig.fromEndpoint(new URL(this.endpoint), this.subscriptionKey)
    } else {
      speechConfig = sdk.SpeechConfig.fromSubscription(this.subscriptionKey, this.serviceRegion)
      if (this.endpoint) {
        // If it's not a URL, assume it's a Custom Speech endpoint ID
        speechConfig.endpointId = this.endpoint
      }
    }

    speechConfig.speechRecognitionLanguage = 'en-US'

    // Match the AudioRecorder format (44.1kHz, 16-bit, stereo)
    this.pushStream = sdk.AudioInputStream.createPushStream(
      sdk.AudioStreamFormat.getWaveFormatPCM(44100, 16, 2)
    )

    const audioConfig = sdk.AudioConfig.fromStreamInput(this.pushStream)
    this.recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig)

    this.recognizer.recognizing = (_, e) => {
      if (e.result.text && this.onRecognizing) {
        this.onRecognizing(e.result.text)
      }
    }

    this.recognizer.recognized = (_, e) => {
      if (e.result.reason === sdk.ResultReason.RecognizedSpeech && e.result.text && this.onRecognized) {
        this.onRecognized(e.result.text)
      }
    }

    this.recognizer.canceled = (_, e) => {
      console.error(`CANCELED: Reason=${e.reason}`)
      if (e.reason === sdk.CancellationReason.Error) {
        console.error(`CANCELED: ErrorCode=${e.errorCode}`)
        console.error(`CANCELED: ErrorDetails=${e.errorDetails}`)
      }
    }

    this.recognizer.sessionStarted = (_, e) => {
      console.log('Session started event.', e)
    }

    this.recognizer.sessionStopped = (_, e) => {
      console.log('Session stopped event.', e)
    }

    this.recognizer.startContinuousRecognitionAsync()
  }

  writeAudioChunk(buffer: ArrayBuffer) {
    if (this.pushStream) {
      this.pushStream.write(buffer)
    }
  }

  async stop() {
    return new Promise<void>((resolve, reject) => {
      if (this.recognizer) {
        this.recognizer.stopContinuousRecognitionAsync(
          () => {
            this.recognizer?.close()
            this.recognizer = null

            if (this.pushStream) {
              this.pushStream.close()
              this.pushStream = null
            }
            resolve()
          },
          (err) => {
            console.error(err)
            reject(err)
          }
        )
      } else {
        resolve()
      }
    })
  }
}
