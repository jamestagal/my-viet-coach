<!--
  Voice Practice Page with Provider Fallback
  Shows active provider badge and handles session time limits
  
  Place in: apps/web/src/routes/practice/+page.svelte
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { VoiceClient, type VoiceProvider } from '$lib/voice/VoiceClient';
  
  // State
  let client: VoiceClient | null = null;
  let isConnected = false;
  let activeProvider: VoiceProvider | null = null;
  let userTranscript = '';
  let coachTranscript = '';
  let error = '';
  let showFallbackNotice = false;
  let fallbackReason = '';
  let sessionTimeRemaining: number | null = null;
  
  // Settings
  let difficulty = 'intermediate';
  let topic = 'daily_life';
  
  const topics = [
    { value: 'daily_life', label: 'Daily Life (Cuộc sống hàng ngày)' },
    { value: 'food', label: 'Food & Dining (Ẩm thực)' },
    { value: 'travel', label: 'Travel (Du lịch)' },
    { value: 'work', label: 'Work (Công việc)' },
    { value: 'culture', label: 'Culture (Văn hóa)' },
  ];

  const systemPrompt = `
# Role
You are a friendly Vietnamese language coach helping an intermediate learner practice conversation.

# Language
- Conduct the conversation primarily in Vietnamese
- The learner will speak Vietnamese; respond in Vietnamese
- When correcting, briefly explain in English, then continue in Vietnamese

# Personality & Tone
- Warm, encouraging, patient
- Use natural conversational particles (à, nhé, nhỉ, ạ)
- Match the learner's pace and complexity level

# Corrections
- Gently correct grammar and tone errors
- Don't interrupt flow for minor mistakes
- Group corrections at natural pause points
- Format: "Ah, một chút sửa nhé: [correct form]. [Brief English explanation]"

# Turn Length
- Keep responses to 2-4 sentences
- Ask follow-up questions to maintain conversation
`.trim();

  async function connect() {
    try {
      error = '';
      showFallbackNotice = false;

      client = new VoiceClient(
        { systemPrompt, voice: 'Kore', language: 'vi' },
        {
          onConnected: (provider) => {
            isConnected = true;
            activeProvider = provider;
            console.log(`Connected to ${provider}`);
          },
          onDisconnected: (reason) => {
            isConnected = false;
            console.log(`Disconnected: ${reason}`);
          },
          onUserTranscript: (text) => {
            userTranscript = text;
          },
          onCoachResponse: (text, isFinal) => {
            coachTranscript = isFinal ? text : coachTranscript + text;
          },
          onCoachAudio: (audioData) => {
            // Audio playback handled by provider
          },
          onError: (err, provider) => {
            error = `${provider}: ${err.message}`;
            console.error(error);
          },
          onProviderFallback: (from, to, reason) => {
            // 🔔 FALLBACK NOTIFICATION
            showFallbackNotice = true;
            fallbackReason = reason;
            console.warn(`Fallback from ${from} to ${to}: ${reason}`);
          },
          onSessionTimeWarning: (remainingSeconds) => {
            sessionTimeRemaining = remainingSeconds;
            // Could auto-reconnect here
          },
        },
        'gemini',  // Primary provider (cheaper)
        'openai'   // Fallback provider (more mature)
      );
      
      await client.connect();

      // Send initial context to start conversation
      client.sendText(
        `Topic: ${topic}, Difficulty: ${difficulty}. Please greet me and start a conversation in Vietnamese.`
      );
      
    } catch (err: any) {
      error = err.message;
    }
  }
  
  function disconnect() {
    client?.disconnect();
    client = null;
    isConnected = false;
    activeProvider = null;
    userTranscript = '';
    coachTranscript = '';
    sessionTimeRemaining = null;
  }
  
  async function extendSession() {
    // Reconnect to reset the 15-minute timer
    await client?.reconnect();
    sessionTimeRemaining = null;
  }
  
  onDestroy(() => {
    disconnect();
  });
</script>

<div class="min-h-screen bg-gradient-to-b from-emerald-50 to-white py-8">
  <div class="max-w-2xl mx-auto px-4">

    <!-- Provider Badge (shows which API is active) -->
    {#if isConnected && activeProvider}
      <div class="fixed top-4 right-4 px-3 py-1 rounded-full text-sm font-medium
                  {activeProvider === 'gemini' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}">
        {activeProvider === 'gemini' ? '🔵 Gemini' : '🟢 OpenAI'}
        {#if showFallbackNotice}
          <span class="text-xs ml-1">(fallback)</span>
        {/if}
      </div>
    {/if}
    
    <!-- Fallback Notice -->
    {#if showFallbackNotice}
      <div class="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800">
        <strong>Note:</strong> Using OpenAI as fallback. Reason: {fallbackReason}
      </div>
    {/if}
    
    <!-- Session Time Warning -->
    {#if sessionTimeRemaining !== null}
      <div class="mb-4 bg-orange-50 border border-orange-200 rounded-xl p-4 text-orange-800 flex justify-between items-center">
        <span>Session ending in {sessionTimeRemaining} seconds</span>
        <button on:click={extendSession} class="px-3 py-1 bg-orange-500 text-white rounded-lg text-sm">
          Extend Session
        </button>
      </div>
    {/if}
    
    <!-- Header -->
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-emerald-800">Speak Phở Real 🍜</h1>
      <p class="text-gray-600">Practice Vietnamese conversation</p>
    </div>

    {#if !isConnected}
      <!-- Setup Screen -->
      <div class="bg-white rounded-2xl shadow-lg p-6">
        <h2 class="text-xl font-semibold text-gray-800 mb-4">Start a Session</h2>
        
        <div class="space-y-4">
          <div>
            <label for="topic" class="block text-sm font-medium text-gray-700 mb-1">Topic</label>
            <select id="topic" bind:value={topic} class="w-full rounded-lg border-gray-300 shadow-sm">
              {#each topics as t}
                <option value={t.value}>{t.label}</option>
              {/each}
            </select>
          </div>
          
          <div>
            <label for="difficulty" class="block text-sm font-medium text-gray-700 mb-1">Your Level</label>
            <select id="difficulty" bind:value={difficulty} class="w-full rounded-lg border-gray-300 shadow-sm">
              <option value="beginner">Beginner (Người mới)</option>
              <option value="intermediate">Intermediate (Trung cấp)</option>
              <option value="advanced">Advanced (Nâng cao)</option>
            </select>
          </div>
        </div>
        
        <button on:click={connect}
          class="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors">
          🎤 Start Practice Session
        </button>
      </div>

    {:else}
      <!-- Active Session -->
      <div class="bg-white rounded-2xl shadow-lg p-6 space-y-6">
        
        <!-- Status -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
            <span class="text-sm text-gray-600">Connected — speak in Vietnamese!</span>
          </div>
          <span class="text-sm text-emerald-600">{topics.find(t => t.value === topic)?.label}</span>
        </div>
        
        <!-- Your Speech -->
        <div>
          <h3 class="text-sm font-medium text-gray-500 mb-2">You said:</h3>
          <div class="bg-gray-50 rounded-xl p-4 min-h-[60px]">
            <p class="text-gray-800">{userTranscript || 'Listening...'}</p>
          </div>
        </div>
        
        <!-- Coach Response -->
        <div>
          <h3 class="text-sm font-medium text-gray-500 mb-2">Coach says:</h3>
          <div class="bg-emerald-50 rounded-xl p-4 min-h-[80px]">
            <p class="text-emerald-800">{coachTranscript || 'Waiting...'}</p>
          </div>
        </div>
        
        <!-- End Session -->
        <button on:click={disconnect}
          class="w-full py-3 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">
          End Session
        </button>
      </div>
    {/if}
    
    <!-- Error -->
    {#if error}
      <div class="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">{error}</div>
    {/if}
    
  </div>
</div>
