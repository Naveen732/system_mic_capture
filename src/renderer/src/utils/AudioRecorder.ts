export class AudioRecorder {
  private audioCtx: AudioContext | null = null
  private desktopStream: MediaStream | null = null
  private micStream: MediaStream | null = null
  private processor: ScriptProcessorNode | null = null

  public onAudioChunk?: (data: ArrayBuffer) => void

  async start() {

    // @ts-ignore
    const sourceId = await window.api.getDesktopSourceId()
    if (!sourceId) {
      throw new Error('Desktop source ID not found')
    }

    this.desktopStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop'
        }
      },
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId
        }
      }
    } as any)

    this.desktopStream.getVideoTracks().forEach((track) => track.stop())

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false
    })

    this.audioCtx = new window.AudioContext()


    const desktopSource = this.audioCtx.createMediaStreamSource(this.desktopStream)
    const micSource = this.audioCtx.createMediaStreamSource(this.micStream)

    // Mix the two sources
    const mixer = this.audioCtx.createGain()
    desktopSource.connect(mixer)
    micSource.connect(mixer)

    // Capture the mixed audio data using ScriptProcessorNode
    // 4096 buffer size, 2 input channels (stereo), 2 output channels
    this.processor = this.audioCtx.createScriptProcessor(4096, 2, 2)

    mixer.connect(this.processor)
    this.processor.connect(this.audioCtx.destination) // Required for processor to work in Chromium

    this.processor.onaudioprocess = (e) => {
      // Interleave left and right channels
      const left = e.inputBuffer.getChannelData(0)
      const right = e.inputBuffer.getChannelData(1)

      const interleaved = new Float32Array(left.length * 2)
      for (let i = 0; i < left.length; i++) {
        interleaved[i * 2] = left[i]
        interleaved[i * 2 + 1] = right[i]
      }
      if (this.onAudioChunk) {
        const pcmBuffer = new ArrayBuffer(interleaved.length * 2)
        const view = new DataView(pcmBuffer)
        let offset = 0
        for (let i = 0; i < interleaved.length; i++, offset += 2) {
          const s = Math.max(-1, Math.min(1, interleaved[i]))
          view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
        }
        this.onAudioChunk(pcmBuffer)
      }

      // Keep output buffer silent to avoid feedback loop
      const outLeft = e.outputBuffer.getChannelData(0)
      const outRight = e.outputBuffer.getChannelData(1)
      for (let i = 0; i < outLeft.length; i++) {
         outLeft[i] = 0;
         outRight[i] = 0;
      }
    }
  }

  async stop(): Promise<void> {
    if (this.processor) {
      this.processor.disconnect()
      this.processor.onaudioprocess = null
      this.processor = null
    }

    if (this.audioCtx) {
      await this.audioCtx.close()
      this.audioCtx = null
    }

    if (this.desktopStream) {
      this.desktopStream.getTracks().forEach((track) => track.stop())
      this.desktopStream = null
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop())
      this.micStream = null
    }
  }
}
