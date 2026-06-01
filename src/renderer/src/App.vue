<script setup lang="ts">
import { ref } from 'vue'
import Versions from './components/Versions.vue'
import { AudioRecorder } from './utils/AudioRecorder'
import { AzureSpeechService } from './utils/AzureSpeechService'

const isRecording = ref(false)
const recorder = new AudioRecorder()
let azureService: AzureSpeechService | null = null

const azureKey = ''
const azureRegion = ''
const azureEndpoint = ''
const recognizedText = ref('')
const recognizingText = ref('')

const startRecording = async () => {
  try {
    recognizedText.value = ''
    recognizingText.value = ''
    
    azureService = new AzureSpeechService(azureKey, azureRegion, azureEndpoint)
    
    azureService.onRecognizing = (text) => {
      recognizingText.value = text
    }
    
    azureService.onRecognized = (text) => {
      recognizedText.value += text + ' '
      recognizingText.value = ''
    }

    azureService.start()
    
    // Connect audio chunks
    recorder.onAudioChunk = (data) => {
      if (azureService) {
        azureService.writeAudioChunk(data)
      }
    }

    await recorder.start()
    isRecording.value = true
  } catch (error) {
    console.error('Failed to start recording', error)
  }
}

const stopRecording = async () => {
  try {
    isRecording.value = false
    
    if (azureService) {
      await azureService.stop()
      azureService = null
    }

    await recorder.stop()
  } catch (error) {
    console.error('Failed to stop recording', error)
  }
}
</script>

<template>
  <img alt="logo" class="logo" src="./assets/electron.svg" />
  <div class="creator">Powered by electron-vite & Azure Speech</div>
  


  <div class="recording-controls" style="margin: 20px 0; text-align: center;">
    <button v-if="!isRecording" @click="startRecording" style="padding: 10px 20px; font-size: 16px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
      Start Recording & Transcribe
    </button>
    <button v-else @click="stopRecording" style="padding: 10px 20px; font-size: 16px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">
      Stop Recording
    </button>
  </div>

  <div class="transcript" style="margin: 20px auto; max-width: 600px; text-align: left; background: #1e1e1e; padding: 20px; border-radius: 8px; min-height: 100px;">
    <h3 style="margin-top: 0; color: #4CAF50;">Live Transcript</h3>
    <p style="white-space: pre-wrap; margin-bottom: 5px;">{{ recognizedText }}</p>
    <p style="white-space: pre-wrap; color: #888; font-style: italic; margin: 0;">{{ recognizingText }}</p>
  </div>

  <Versions />
</template>

<style>
/* Add any additional styles if needed, basic inline styles used above */
</style>
