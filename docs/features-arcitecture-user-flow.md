# Speak Phở Real — Feature Architecture & Implementation Plan

> **Document Version:** 2.0  
> **Last Updated:** December 2024  
> **Status:** Approved for Development

---

## Executive Summary

**Speak Phở Real** is a speaking-first Vietnamese learning app that scaffolds learners from single sounds to natural conversation through progressive practice modes, real-time feedback, and tone visualization.

### Key Decisions (Locked In)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **App Name** | Speak Phở Real 🍜 | Memorable pun, fun branding, phở is globally recognized |
| **Pitch Visualization** | Post-recording first, real-time later | Ship faster, validate demand, add wow factor in Phase 2 |
| **Audio for Drills** | Pre-recorded native speakers | Authenticity matters for pronunciation training |
| **Audio for Custom Text** | AI-generated (OpenAI Realtime) | Can't pre-record everything |
| **Target Audience** | English-speaking Vietnamese learners | Heritage speakers, expats, travel enthusiasts |
| **Regional Accent** | User-selectable: Northern (Hanoi) or Southern (Saigon) | Accommodate family dialect matching |

### Core Differentiators

1. **Tone Visualization** — See your pitch contour vs. native speaker (unique for Vietnamese)
2. **"Bring Your Own" Text** — Practice ANY Vietnamese text you encounter
3. **Karaoke Shadowing** — Word-by-word highlighting while speaking along
4. **Scaffolded Progression** — Sounds → Words → Phrases → Dialogues → Free Conversation

---

## Table of Contents

1. [App Structure Overview](#app-structure-overview)
2. [Learning Scaffold](#learning-scaffold)
3. [Feature Specifications](#feature-specifications)
4. [Technical Architecture](#technical-architecture)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Content Requirements](#content-requirements)
8. [Implementation Phases](#implementation-phases)
9. [Development Milestones](#development-milestones)

---

## App Structure Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      SPEAK PHỞ REAL 🍜                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐    │
│  │   LEARN   │  │  PRACTICE │  │   TALK    │  │  PROFILE  │    │
│  │           │  │           │  │           │  │           │    │
│  │ Structured│  │ Drill     │  │ Free AI   │  │ Progress  │    │
│  │ Lessons   │  │ Modes     │  │ Convo     │  │ Settings  │    │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘    │
│       │              │              │              │            │
│       ▼              ▼              ▼              ▼            │
│  ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐      │
│  │ Tones   │   │ Custom   │   │ Scenarios│   │ Stats    │      │
│  │ Alphabet│   │ Text     │   │ Free Chat│   │ Streaks  │      │
│  │ Sounds  │   │ Dialogues│   │          │   │ Settings │      │
│  │ Phrases │   │ Shadowing│   │          │   │ Accent   │      │
│  └─────────┘   └──────────┘   └──────────┘   └──────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Navigation Tabs

| Tab | Purpose | Primary Features |
|-----|---------|------------------|
| **LEARN** | Structured foundation lessons | Tone training, Alphabet, Essential phrases |
| **PRACTICE** | Active speaking drills | Custom text, Curated drills, Karaoke shadowing, Dialogues |
| **TALK** | Free AI conversation | Scenario-based chat, Free chat, Post-conversation review |
| **PROFILE** | Progress & settings | Stats, Streaks, Accent preference, Subscription |

---

## Learning Scaffold

Users progress through increasingly complex speaking challenges:

```
                          ┌─────────────────────┐
                          │  FREE CONVERSATION  │  Level 6
                          │  (AI improvises)    │  ← Uses OpenAI Realtime API
                          └──────────┬──────────┘
                                     │
                          ┌──────────▼──────────┐
                          │ STRUCTURED DIALOGUE │  Level 5
                          │ (Read your lines)   │  ← Pre-recorded + AI evaluation
                          └──────────┬──────────┘
                                     │
                          ┌──────────▼──────────┐
                          │   FULL SENTENCES    │  Level 4
                          │  (Karaoke shadow)   │  ← Pre-recorded native audio
                          └──────────┬──────────┘
                                     │
                          ┌──────────▼──────────┐
                          │      PHRASES        │  Level 3
                          │   (2-5 words)       │  ← Pre-recorded native audio
                          └──────────┬──────────┘
                                     │
                          ┌──────────▼──────────┐
                          │    SINGLE WORDS     │  Level 2
                          │  (Minimal pairs)    │  ← Pre-recorded native audio
                          └──────────┬──────────┘
                                     │
                          ┌──────────▼──────────┐
                          │   SOUNDS & TONES    │  Level 1
                          │  (Foundation)       │  ← Pre-recorded native audio
                          └─────────────────────┘
```

### Audio Source Strategy

| Content Type | Audio Source | Rationale |
|--------------|--------------|-----------|
| Tone drills (Level 1) | Pre-recorded native speakers | Authenticity critical for tone learning |
| Word drills (Level 2) | Pre-recorded native speakers | Need perfect pronunciation models |
| Phrase drills (Level 3) | Pre-recorded native speakers | Consistency across practice sessions |
| Sentence shadowing (Level 4) | Pre-recorded native speakers | Karaoke sync requires precise timing |
| Dialogue lines (Level 5) | Pre-recorded native speakers | AI partner voice + native model for user lines |
| Free conversation (Level 6) | OpenAI Realtime API | Dynamic, unscripted interaction |
| Custom text ("Bring Your Own") | OpenAI Realtime API | Can't pre-record user-provided content |

---

## Feature Specifications

### 1. LEARN Tab Features

#### 1.1 Tone Foundation

**Purpose:** Master the 6 Vietnamese tones before anything else.

**UI Mockup:**
```
┌─────────────────────────────────────────────────────────────────┐
│  🎵 TONE TRAINING                                               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  PITCH DIAGRAM (Interactive)                            │    │
│  │                                                         │    │
│  │     ───────────────  Ngang (level)      a               │    │
│  │            ╲                                            │    │
│  │             ╲         Huyền (falling)   à               │    │
│  │              ────╱                                      │    │
│  │                 ╱     Hỏi (dipping)     ả               │    │
│  │     ──────────╱                                         │    │
│  │              ╱        Ngã (broken)      ã               │    │
│  │     ───────╱                                            │    │
│  │           ╱           Sắc (rising)      á               │    │
│  │     ─────•            Nặng (heavy)      ạ               │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Currently learning: Thanh Sắc (Rising Tone) /                  │
│                                                                 │
│  Practice words:                                                │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                   │
│  │   má   │ │   cá   │ │   lá   │ │   nhá  │                   │
│  │ mother │ │  fish  │ │  leaf  │ │  okay  │                   │
│  │ [▶ 🎤] │ │ [▶ 🎤] │ │ [▶ 🎤] │ │ [▶ 🎤] │                   │
│  └────────┘ └────────┘ └────────┘ └────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Sub-lessons:**

| Lesson | Content | Duration |
|--------|---------|----------|
| 1.1.1 Introduction | Video/animation explaining tones | 3 min |
| 1.1.2 Ngang & Sắc | Level vs. rising tone | 5 min |
| 1.1.3 Huyền & Nặng | Falling vs. heavy tone | 5 min |
| 1.1.4 Hỏi & Ngã | Dipping vs. broken tone (hardest!) | 7 min |
| 1.1.5 All Tones Mixed | Discrimination + production practice | 10 min |
| 1.1.6 Minimal Pairs Challenge | ma/mà/má/mả/mã/mạ sets | 10 min |

**Data Model:**
```typescript
interface ToneLesson {
  id: string;
  tone_id: 'ngang' | 'huyen' | 'sac' | 'hoi' | 'nga' | 'nang';
  tone_mark: '' | '̀' | '́' | '̉' | '̃' | '̣';
  description: {
    en: string;
    vi: string;
  };
  pitch_pattern: 'level' | 'falling' | 'rising' | 'dipping' | 'broken' | 'heavy';
  example_words: ToneWord[];
  audio_northern: string; // R2 URL
  audio_southern: string; // R2 URL
}

interface ToneWord {
  word: string;
  meaning_en: string;
  audio_northern: string;
  audio_southern: string;
  pitch_contour_data: number[]; // For visualization overlay
}
```

#### 1.2 Alphabet & Sounds

**Content Structure:**

| Category | Items | Priority |
|----------|-------|----------|
| Basic Vowels | a, ă, â, e, ê, i, o, ô, ơ, u, ư, y | Phase 1 |
| Consonants (easy) | b, c, d, đ, g, h, k, l, m, n, p, q, r, s, t, v, x | Phase 1 |
| Consonants (tricky) | gi, ng, nh, tr, ch, kh, ph, th | Phase 1 |
| Vowel Combos | iê/ia, ươ/ưa, uô/ua | Phase 2 |
| Final Consonants | -c, -ch, -m, -n, -ng, -nh, -p, -t | Phase 2 |

#### 1.3 Essential Phrases

**Categories (MVP):**

| Category | Phrases | Audio Files Needed |
|----------|---------|-------------------|
| Greetings | 15 | 30 (N + S accents) |
| Politeness | 10 | 20 |
| Numbers 1-100 | 20 | 40 |
| Food & Ordering | 25 | 50 |
| Directions | 15 | 30 |
| Shopping | 15 | 30 |
| **Total MVP** | **100** | **200** |

---

### 2. PRACTICE Tab Features

#### 2.1 Custom Text Drills ("Bring Your Own") ⭐ KEY DIFFERENTIATOR

**Purpose:** Let users practice ANY Vietnamese text they encounter in the wild.

**User Flow:**
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ User pastes  │     │ App parses   │     │ AI generates │     │ Practice     │
│ Vietnamese   │ ──▶ │ into         │ ──▶ │ model audio  │ ──▶ │ with         │
│ text         │     │ sentences    │     │ (Realtime)   │     │ feedback     │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

**UI - Text Input:**
```
┌─────────────────────────────────────────────────────────────────┐
│  📝 CUSTOM TEXT PRACTICE                                        │
│                                                                 │
│  Paste Vietnamese text you want to practice:                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Xin chào, tôi tên là Ben. Tôi đến từ Úc.               │    │
│  │ Tôi đang học tiếng Việt vì tôi rất thích               │    │
│  │ văn hóa Việt Nam.                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ ⚡ Quick Practice │  │ 📊 Deep Analysis │                    │
│  │ Sentence by      │  │ Word by word     │                    │
│  │ sentence         │  │ with tone graphs │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                 │
│  📚 Recent texts:                                               │
│  • "Cảm ơn bạn rất nhiều" — 3x ⭐                               │
│  • "Cho tôi xem cái này" — 1x                                  │
│  • "Bao giờ bạn rảnh?" — 5x ⭐⭐                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**UI - Practice Screen:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Practicing: "Tôi đang học tiếng Việt"              [1/3]      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🔊 MODEL PRONUNCIATION                                 │    │
│  │  [▶ Play]  [🐢 0.75x]  [🔁 Loop]                        │    │
│  │                                                         │    │
│  │  Pitch contour (reference):                             │    │
│  │      ┌──╲    ╱──┐                                       │    │
│  │  ────┘    ╲╱    └────────                               │    │
│  │  Tôi   đang  học  tiếng  Việt                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🎤 YOUR TURN                                           │    │
│  │                                                         │    │
│  │  [ Hold to Record 🎤 ]                                  │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [Skip →]                                    [Hear Model Again] │
└─────────────────────────────────────────────────────────────────┘
```

**UI - Post-Recording Feedback (with Pitch Visualization):**
```
┌─────────────────────────────────────────────────────────────────┐
│  ✅ Recording complete!                                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  PITCH COMPARISON                                       │    │
│  │                                                         │    │
│  │  Model:  ──┐  ┌──╱  ───╲  ╱──  ───╱                    │    │
│  │            └──┘                                         │    │
│  │                                                         │    │
│  │  You:    ──┐  ┌───   ───╲  ╱──  ──╱                    │    │
│  │            └──┘  ▲                                      │    │
│  │               [Mismatch: should rise more]              │    │
│  │                                                         │    │
│  │           Tôi  đang  học  tiếng  Việt                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Word-by-word feedback:                                         │
│  ✅ Tôi — Good level tone                                       │
│  ⚠️ đang — Tone was flat, should be falling (huyền)            │
│  ✅ học — Nice sharp cutoff on the -c                           │
│  ✅ tiếng — Good rising tone                                    │
│  ✅ Việt — Clear!                                               │
│                                                                 │
│  Overall: ⭐⭐⭐⭐ 80%                                            │
│                                                                 │
│  [🔁 Try Again]  [▶ Next Sentence]  [⭐ Mark Mastered]          │
└─────────────────────────────────────────────────────────────────┘
```

**Technical Implementation:**

```typescript
// Custom text processing flow
interface CustomTextSession {
  id: string;
  user_id: string;
  original_text: string;
  parsed_sentences: ParsedSentence[];
  created_at: Date;
  practice_count: number;
  last_practiced: Date;
  is_favorite: boolean;
}

interface ParsedSentence {
  index: number;
  text: string;
  words: ParsedWord[];
  model_audio_url?: string; // Generated by OpenAI Realtime
  model_pitch_contour?: number[];
}

interface ParsedWord {
  word: string;
  tone: ToneType;
  start_time_ms: number; // For karaoke sync
  end_time_ms: number;
}

interface PracticeAttempt {
  id: string;
  session_id: string;
  sentence_index: number;
  user_audio_blob: Blob;
  user_pitch_contour: number[];
  feedback: WordFeedback[];
  overall_score: number; // 0-100
  created_at: Date;
}

interface WordFeedback {
  word: string;
  expected_tone: ToneType;
  detected_tone: ToneType;
  is_correct: boolean;
  suggestion?: string;
}
```

#### 2.2 Curated Drill Library

**Drill Categories & Content:**

| Category | Drills | Items per Drill | Audio Files |
|----------|--------|-----------------|-------------|
| 🎵 Tones | 6 | 10 words each | 120 |
| 🔤 Sounds | 10 | 8 words each | 160 |
| 🍜 Food | 15 | 5 phrases each | 150 |
| 👋 Greetings | 8 | 5 phrases each | 80 |
| 🔢 Numbers | 5 | 20 items each | 200 |
| 🎭 Tongue Twisters | 6 | 3 each | 36 |
| 🛒 Shopping | 12 | 5 phrases each | 120 |
| 🚕 Travel | 10 | 5 phrases each | 100 |
| **Total** | **72 drills** | | **~970 audio files** |

**Data Model:**
```typescript
interface DrillCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  drills: Drill[];
  is_premium: boolean;
}

interface Drill {
  id: string;
  category_id: string;
  name: string;
  description: string;
  difficulty: 1 | 2 | 3; // Stars
  items: DrillItem[];
  estimated_minutes: number;
}

interface DrillItem {
  id: string;
  type: 'word' | 'phrase' | 'sentence' | 'minimal_pair';
  content: string;
  translation_en: string;
  audio_northern: string;
  audio_southern: string;
  pitch_contour_northern: number[];
  pitch_contour_southern: number[];
  // For minimal pairs
  pair_content?: string;
  pair_translation_en?: string;
  pair_audio_northern?: string;
  pair_audio_southern?: string;
}
```

#### 2.3 Karaoke Shadowing Mode ⭐ KEY DIFFERENTIATOR

**Purpose:** Train natural rhythm and pacing by speaking along with word-by-word highlighted text.

**Three Sub-Modes:**

| Mode | Description | Flow |
|------|-------------|------|
| **Listen First** | Hear full sentence with highlighting, then record | Model plays → Highlight words → User records after |
| **Shadow Along** | Speak simultaneously with audio | Model plays + User speaks together → Compare after |
| **Record After** | Listen, short pause, then record | Model plays → 2 sec pause → User records |

**UI - Shadowing Screen:**
```
┌─────────────────────────────────────────────────────────────────┐
│  🎤 KARAOKE SHADOWING                                           │
│                                                                 │
│  Sentence: "Tôi rất thích ăn phở Việt Nam"                     │
│                                                                 │
│  Mode: [● Listen First] [○ Shadow Along] [○ Record After]      │
│  Speed: [🐢 0.5x] [● 0.75x] [○ 1.0x] [○ 1.2x]                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                         │    │
│  │   Tôi   rất   [thích]   ăn   phở   Việt   Nam          │    │
│  │               ^^^^^^^^                                  │    │
│  │            Currently playing                            │    │
│  │                                                         │    │
│  │   ═══════════════████░░░░░░░░░░░░░░░░░░░░░░░           │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  PITCH CONTOUR                                          │    │
│  │                                                         │    │
│  │  Model: ──┐  ┌──╱  ───╲  ─╲  ╱──  ───╱  ───            │    │
│  │           └──┘                                          │    │
│  │  You:   (will appear after recording)                   │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [▶ Play]  [🎤 Record]  [🔁 Repeat]  [📊 Analysis]             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Speed Ladder Progression:**
```
┌─────────────────────────────────────────────────────────────────┐
│  🏃 SPEED LADDER                                                │
│                                                                 │
│  "Cảm ơn bạn rất nhiều"                                        │
│                                                                 │
│   🐢 0.5x   [███████████] ✅ Mastered (3 perfect in a row)     │
│   🚶 0.75x  [███████░░░░] 70% — Current level                  │
│   🏃 1.0x   [░░░░░░░░░░░] 🔒 Locked                            │
│   🚀 1.2x   [░░░░░░░░░░░] 🔒 Locked                            │
│                                                                 │
│  Rule: 3 consecutive scores ≥85% to unlock next speed          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Technical: Karaoke Sync Data:**
```typescript
interface KaraokeSentence {
  id: string;
  text: string;
  audio_url: string;
  duration_ms: number;
  words: KaraokeWord[];
}

interface KaraokeWord {
  word: string;
  start_ms: number;
  end_ms: number;
  tone: ToneType;
}

// Example data:
const exampleSentence: KaraokeSentence = {
  id: "ks_001",
  text: "Tôi rất thích ăn phở Việt Nam",
  audio_url: "https://r2.../sentence_001.mp3",
  duration_ms: 2800,
  words: [
    { word: "Tôi", start_ms: 0, end_ms: 300, tone: "ngang" },
    { word: "rất", start_ms: 350, end_ms: 550, tone: "sac" },
    { word: "thích", start_ms: 600, end_ms: 900, tone: "sac" },
    { word: "ăn", start_ms: 950, end_ms: 1100, tone: "ngang" },
    { word: "phở", start_ms: 1150, end_ms: 1400, tone: "hoi" },
    { word: "Việt", start_ms: 1450, end_ms: 1700, tone: "sac" },
    { word: "Nam", start_ms: 1750, end_ms: 2000, tone: "ngang" },
  ]
};
```

#### 2.4 Structured Dialogue Practice

**Purpose:** Practice realistic exchanges with scripted lines.

**UI - Dialogue Screen:**
```
┌─────────────────────────────────────────────────────────────────┐
│  💬 DIALOGUE: Ordering Coffee ☕                                │
│  Your role: Customer | Difficulty: ⭐⭐                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                         │    │
│  │  👤 Nhân viên:                                          │    │
│  │  "Chào anh, anh muốn uống gì ạ?"                       │    │
│  │  (Hello sir, what would you like to drink?)            │    │
│  │  [🔊 Playing...]                                        │    │
│  │                                                         │    │
│  │  ─────────────────────────────────────────────────────  │    │
│  │                                                         │    │
│  │  🎤 Your line:                                          │    │
│  │  "Cho tôi một ly cà phê sữa đá."                       │    │
│  │  (Give me an iced coffee with milk.)                   │    │
│  │                                                         │    │
│  │  [▶ Hear First]  [🎤 Record Now]                        │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Line 1 of 4                              [💡 Hint] [📖 Trans] │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Dialogue Library (MVP):**

| Category | Dialogues | Lines per Dialogue | Total Lines |
|----------|-----------|-------------------|-------------|
| Food & Drink | 5 | 6-8 | ~35 |
| Shopping | 4 | 6-8 | ~28 |
| Transport | 3 | 4-6 | ~15 |
| Greetings | 3 | 4-6 | ~15 |
| **Total MVP** | **15** | | **~93 lines** |

**Data Model:**
```typescript
interface Dialogue {
  id: string;
  title: string;
  title_vi: string;
  category: string;
  difficulty: 1 | 2 | 3;
  description: string;
  user_role: string;
  ai_role: string;
  lines: DialogueLine[];
  estimated_minutes: number;
}

interface DialogueLine {
  index: number;
  speaker: 'user' | 'ai';
  text_vi: string;
  text_en: string;
  audio_northern: string;
  audio_southern: string;
  pitch_contour: number[];
  hints?: string[];
}
```

---

### 3. TALK Tab Features

#### 3.1 Free Conversation (AI Coach)

**Purpose:** Unscripted conversation practice using OpenAI Realtime API.

**Scenarios (MVP):**

| Scenario | Description | Difficulty |
|----------|-------------|------------|
| ☕ Coffee Shop | Ordering drinks, small talk | ⭐ |
| 🍜 Restaurant | Ordering food, asking for bill | ⭐⭐ |
| 🛍️ Market | Bargaining, asking prices | ⭐⭐ |
| 🚕 Getting Around | Taxi, directions | ⭐⭐ |
| 🏠 Meeting Family | Greetings, introductions | ⭐⭐⭐ |
| 🗣️ Free Chat | Open conversation | Any |

**Settings:**

| Setting | Options | Default |
|---------|---------|---------|
| Feedback timing | During / After | During |
| Difficulty | Beginner / Intermediate / Advanced | Beginner |
| AI speech speed | Slow / Normal / Fast | Slow |
| Show transcription | Yes / No | Yes |

**Post-Conversation Review:**
```
┌─────────────────────────────────────────────────────────────────┐
│  📊 CONVERSATION REVIEW                                         │
│                                                                 │
│  Duration: 4:23 | Your speaking: 52% | Turns: 8                │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ⚠️ Words to practice:                                  │    │
│  │                                                         │    │
│  │  "nhiều" — tone was falling, should rise (sắc)         │    │
│  │  [Add to Practice List 📝]                              │    │
│  │                                                         │    │
│  │  "được" — final -c needs sharper cutoff                │    │
│  │  [Add to Practice List 📝]                              │    │
│  │                                                         │    │
│  │  ✅ Great pronunciation:                                │    │
│  │  • "cảm ơn" — perfect tones!                           │    │
│  │  • "xin lỗi" — clear and natural                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [🎧 Replay]  [📝 Add All to Practice]  [🔁 Try Again]         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 4. PROFILE Tab Features

#### 4.1 Progress Dashboard

**Tracked Metrics:**

| Metric | Description |
|--------|-------------|
| Practice time | Total minutes this week/month |
| Streak | Consecutive days with ≥1 practice |
| Phrases practiced | Unique phrases attempted |
| Conversations | Free conversation sessions |
| Avg tone accuracy | Rolling average of tone scores |
| Problem sounds | Tones/sounds with <70% accuracy |

#### 4.2 Settings

| Setting | Options |
|---------|---------|
| Accent preference | Northern (Hanoi) / Southern (Saigon) |
| Daily goal | 5 / 10 / 15 / 20 minutes |
| Reminder time | User-set notification time |
| Show translations | Always / On tap / Never |
| Feedback verbosity | Minimal / Standard / Detailed |

---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT                                  │
│                    (SvelteKit PWA)                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   UI/UX     │  │   Audio     │  │   Pitch Analysis        │ │
│  │  Components │  │  Capture    │  │   (Post-recording)      │ │
│  │  (Svelte)   │  │ (MediaRec)  │  │   Pitchfinder.js        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              WebRTC Connection Manager                  │   │
│  │           (for OpenAI Realtime API sessions)            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS / WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND                                  │
│                   (Cloudflare Workers)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  Auth       │  │  API        │  │  Session Token          │ │
│  │  (Clerk)    │  │  Routes     │  │  Generator              │ │
│  │             │  │             │  │  (for OpenAI)           │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  D1         │  │  R2         │  │  KV                     │ │
│  │  (Progress  │  │  (Audio     │  │  (Session cache,        │ │
│  │   Data)     │  │   Files)    │  │   rate limits)          │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                                                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────┐  ┌──────────────────────────┐│
│  │    OpenAI Realtime API       │  │    Stripe                ││
│  │                              │  │    (Payments)            ││
│  │    • Free conversation       │  │                          ││
│  │    • Custom text audio gen   │  │                          ││
│  │    • Pronunciation feedback  │  │                          ││
│  └──────────────────────────────┘  └──────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Pitch Detection Implementation

**Phase 1: Post-Recording Analysis (MVP)**

```typescript
// Using Pitchfinder.js for pitch detection
import Pitchfinder from 'pitchfinder';

const detectPitch = Pitchfinder.YIN({ sampleRate: 44100 });

async function analyzePitchContour(audioBlob: Blob): Promise<number[]> {
  const audioContext = new AudioContext();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  const channelData = audioBuffer.getChannelData(0);
  const pitchContour: number[] = [];
  
  // Analyze in 20ms windows
  const windowSize = Math.floor(audioBuffer.sampleRate * 0.02);
  
  for (let i = 0; i < channelData.length; i += windowSize) {
    const window = channelData.slice(i, i + windowSize);
    const pitch = detectPitch(window);
    pitchContour.push(pitch || 0);
  }
  
  return smoothContour(pitchContour);
}

function smoothContour(contour: number[]): number[] {
  // Apply moving average to reduce noise
  const windowSize = 3;
  return contour.map((_, i, arr) => {
    const start = Math.max(0, i - windowSize);
    const end = Math.min(arr.length, i + windowSize + 1);
    const window = arr.slice(start, end).filter(v => v > 0);
    return window.length > 0 
      ? window.reduce((a, b) => a + b) / window.length 
      : 0;
  });
}
```

**Phase 2: Real-Time Visualization (Future)**

```typescript
// Real-time pitch tracking using AudioWorklet
class PitchProcessor extends AudioWorkletProcessor {
  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>) {
    const input = inputs[0][0];
    if (input) {
      const pitch = this.detectPitch(input);
      this.port.postMessage({ pitch, timestamp: currentTime });
    }
    return true;
  }
}
```

### Karaoke Sync Implementation

```typescript
interface KaraokePlayer {
  sentence: KaraokeSentence;
  audio: HTMLAudioElement;
  currentWordIndex: number;
  onWordChange: (index: number) => void;
}

function createKaraokePlayer(sentence: KaraokeSentence): KaraokePlayer {
  const audio = new Audio(sentence.audio_url);
  
  audio.addEventListener('timeupdate', () => {
    const currentMs = audio.currentTime * 1000;
    const wordIndex = sentence.words.findIndex(
      (w, i) => currentMs >= w.start_ms && 
                (i === sentence.words.length - 1 || currentMs < sentence.words[i + 1].start_ms)
    );
    
    if (wordIndex !== player.currentWordIndex) {
      player.currentWordIndex = wordIndex;
      player.onWordChange(wordIndex);
    }
  });
  
  const player: KaraokePlayer = {
    sentence,
    audio,
    currentWordIndex: -1,
    onWordChange: () => {}
  };
  
  return player;
}
```

---

## Database Schema

### D1 Tables

```sql
-- Users (synced from Clerk)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT,
  display_name TEXT,
  accent_preference TEXT DEFAULT 'northern', -- 'northern' | 'southern'
  daily_goal_minutes INTEGER DEFAULT 10,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Practice Sessions
CREATE TABLE practice_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_type TEXT NOT NULL, -- 'drill' | 'dialogue' | 'custom_text' | 'conversation' | 'shadowing'
  content_id TEXT, -- Reference to drill/dialogue/custom_text
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME,
  duration_seconds INTEGER,
  score REAL, -- 0-100
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Custom Texts (user-provided)
CREATE TABLE custom_texts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  original_text TEXT NOT NULL,
  parsed_data TEXT NOT NULL, -- JSON: ParsedSentence[]
  is_favorite BOOLEAN DEFAULT FALSE,
  practice_count INTEGER DEFAULT 0,
  last_practiced DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Practice Attempts (individual recordings)
CREATE TABLE practice_attempts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content_text TEXT NOT NULL,
  score REAL, -- 0-100
  feedback_data TEXT, -- JSON: WordFeedback[]
  audio_url TEXT, -- R2 URL (optional, for review)
  pitch_contour TEXT, -- JSON: number[]
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES practice_sessions(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- User Progress (aggregated stats)
CREATE TABLE user_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  practice_minutes INTEGER DEFAULT 0,
  phrases_practiced INTEGER DEFAULT 0,
  conversations_count INTEGER DEFAULT 0,
  avg_tone_accuracy REAL,
  streak_days INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, date)
);

-- Problem Words (for personalized practice)
CREATE TABLE problem_words (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  word TEXT NOT NULL,
  tone TEXT NOT NULL,
  error_count INTEGER DEFAULT 1,
  last_error DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_resolved BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, word)
);

-- Voice Credit Usage
CREATE TABLE credit_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT,
  minutes_used REAL NOT NULL,
  cost_usd REAL NOT NULL,
  usage_type TEXT NOT NULL, -- 'conversation' | 'custom_text_gen'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### R2 Bucket Structure

```
speak-pho-real-assets/
├── audio/
│   ├── tones/
│   │   ├── northern/
│   │   │   ├── ngang_ma.mp3
│   │   │   ├── huyen_ma.mp3
│   │   │   └── ...
│   │   └── southern/
│   │       └── ...
│   ├── drills/
│   │   ├── food/
│   │   │   ├── northern/
│   │   │   └── southern/
│   │   └── ...
│   ├── dialogues/
│   │   ├── coffee_shop/
│   │   │   ├── line_01_ai_northern.mp3
│   │   │   ├── line_01_ai_southern.mp3
│   │   │   └── ...
│   │   └── ...
│   └── phrases/
│       └── ...
├── pitch_contours/
│   ├── reference/
│   │   └── [content_id].json
│   └── user/
│       └── [attempt_id].json
└── user_recordings/
    └── [user_id]/
        └── [attempt_id].webm
```

---

## API Endpoints

### Authentication
```
POST /api/auth/session     # Get/refresh session token
GET  /api/auth/user        # Get current user profile
```

### Content
```
GET  /api/drills                    # List drill categories
GET  /api/drills/:category          # Get drills in category
GET  /api/drills/:category/:id      # Get drill content

GET  /api/dialogues                 # List dialogues
GET  /api/dialogues/:id             # Get dialogue content

GET  /api/phrases/:category         # Get phrase list
```

### Custom Text
```
POST /api/custom-text               # Create new custom text session
GET  /api/custom-text               # List user's custom texts
GET  /api/custom-text/:id           # Get specific custom text
DELETE /api/custom-text/:id         # Delete custom text
POST /api/custom-text/:id/favorite  # Toggle favorite
```

### Practice
```
POST /api/practice/session          # Start practice session
PUT  /api/practice/session/:id      # End session (with stats)
POST /api/practice/attempt          # Record practice attempt
GET  /api/practice/history          # Get practice history
```

### Conversation (OpenAI Realtime)
```
POST /api/conversation/token        # Get ephemeral token for WebRTC
POST /api/conversation/end          # End conversation, get summary
```

### Progress
```
GET  /api/progress/dashboard        # Get progress dashboard data
GET  /api/progress/streak           # Get streak info
GET  /api/progress/problem-words    # Get words needing practice
POST /api/progress/problem-words    # Add word to problem list
```

### User Settings
```
GET  /api/settings                  # Get user settings
PUT  /api/settings                  # Update settings
```

---

## Content Requirements

### Audio Recording Needs

| Category | Items | × 2 Accents | Total Files |
|----------|-------|-------------|-------------|
| Tone examples | 60 words | 120 | 120 |
| Alphabet/sounds | 80 items | 160 | 160 |
| Essential phrases | 100 phrases | 200 | 200 |
| Drill content | ~500 items | 1000 | 1000 |
| Dialogue lines | ~100 lines | 200 | 200 |
| **TOTAL** | | | **~1680 files** |

### Native Speaker Recording Plan

**Option A: Fiverr Voice Actors**
- Cost: ~$50-100 per hour of recording
- Estimate: 1680 files × 3 sec avg = ~1.5 hours raw audio
- Total cost: ~$150-300 for both accents

**Option B: Vietnamese Language Teacher**
- May have existing materials
- More authentic classroom-style pronunciation
- Potential for ongoing relationship

**Option C: Community Contributors**
- Free but less controlled quality
- Could work for expansion content

**Recommendation:** Start with Fiverr for MVP (controlled quality, fast), expand with teacher/community later.

### Recording Specifications

| Spec | Value |
|------|-------|
| Format | MP3 (128kbps) or WebM |
| Sample Rate | 44.1kHz |
| Channels | Mono |
| Normalization | -3dB peak |
| Silence padding | 200ms before/after |
| Background noise | <-50dB |

---

## Implementation Phases

### Phase 1: MVP (8-10 weeks)

**Goal:** Launchable product with core features

**Features:**
- [x] Free Conversation (existing)
- [x] Coach Mode (existing)
- [ ] Custom Text Drills (basic - text feedback only)
- [ ] Basic Tone Training (6 tones, minimal pairs)
- [ ] Progress Tracking (streaks, time)
- [ ] User Settings (accent preference)
- [ ] Credit-based pricing

**Tech:**
- [ ] D1 database schema
- [ ] R2 audio storage
- [ ] Basic API endpoints
- [ ] Stripe integration

**Content:**
- [ ] Record 200 core audio files (tones + essential phrases)
- [ ] Create 10 basic drills

### Phase 2: Differentiation (6-8 weeks)

**Goal:** Unique features that set us apart

**Features:**
- [ ] Pitch Visualization (post-recording comparison)
- [ ] Karaoke Shadowing Mode
- [ ] Structured Dialogues (5 dialogues)
- [ ] Speed Ladder
- [ ] Problem Words tracking

**Tech:**
- [ ] Pitchfinder.js integration
- [ ] Karaoke sync engine
- [ ] Enhanced feedback system

**Content:**
- [ ] Record 500 more audio files (drills + dialogues)
- [ ] Create karaoke timing data for 50 sentences

### Phase 3: Polish & Scale (4-6 weeks)

**Goal:** Production-ready, scalable

**Features:**
- [ ] Curated Drill Library (full)
- [ ] Daily Warmups
- [ ] Detailed Analytics
- [ ] Onboarding flow
- [ ] Push notifications

**Tech:**
- [ ] Performance optimization
- [ ] Error tracking (Sentry)
- [ ] Analytics (Mixpanel/Amplitude)

**Content:**
- [ ] Complete drill library (~970 files)
- [ ] 10 more dialogues

### Phase 4: Growth (Ongoing)

**Features:**
- [ ] Real-time pitch visualization
- [ ] Social features (leaderboards?)
- [ ] User-generated content
- [ ] Additional languages?

---

## Development Milestones

### Milestone 1: Database & Auth (Week 1-2)
- [ ] Set up D1 database with schema
- [ ] Integrate Clerk authentication
- [ ] Create user profile API
- [ ] Set up R2 bucket structure

### Milestone 2: Core Practice Flow (Week 3-4)
- [ ] Build Custom Text input UI
- [ ] Implement sentence parsing
- [ ] Create practice session flow
- [ ] Basic text-based feedback

### Milestone 3: Audio Integration (Week 5-6)
- [ ] Record initial 200 audio files
- [ ] Upload to R2 with metadata
- [ ] Build audio playback components
- [ ] Implement recording capture

### Milestone 4: Progress System (Week 7-8)
- [ ] Streak tracking
- [ ] Practice history
- [ ] Progress dashboard UI
- [ ] Problem words system

### Milestone 5: Payments & Launch (Week 9-10)
- [ ] Stripe integration
- [ ] Credit purchase flow
- [ ] Usage tracking
- [ ] Landing page
- [ ] Beta launch!

### Milestone 6: Pitch Visualization (Week 11-13)
- [ ] Integrate Pitchfinder.js
- [ ] Build pitch contour visualization
- [ ] Create comparison overlay
- [ ] Enhance feedback with visual data

### Milestone 7: Karaoke Shadowing (Week 14-16)
- [ ] Create karaoke timing data for content
- [ ] Build word highlighting engine
- [ ] Implement three sub-modes
- [ ] Speed ladder system

### Milestone 8: Dialogues (Week 17-18)
- [ ] Record dialogue audio
- [ ] Build dialogue practice UI
- [ ] Line-by-line feedback
- [ ] Dialogue completion scoring

---

## Success Metrics

### MVP Launch Targets
- 100 beta users
- 50% Day-7 retention
- Average 3 practice sessions per user per week
- <5% crash rate

### Growth Targets (3 months post-launch)
- 500 paying users
- $5,000 MRR
- 4.5+ App Store rating
- 60% Month-1 retention

---

## Open Questions

1. **Audio Recording:** Fiverr vs. Vietnamese teacher vs. hybrid approach?
2. **Pricing Tiers:** Finalize credit packages and pricing
3. **Regional Launch:** Vietnam-first or diaspora-first?
4. **App vs. PWA:** Native apps needed for MVP or PWA sufficient?

---

## Appendix

### A. Tone Reference

| Tone | Vietnamese | Mark | Pattern | Example |
|------|------------|------|---------|---------|
| Ngang | Thanh ngang | (none) | Level, mid pitch | ma (ghost) |
| Huyền | Thanh huyền | ` | Falling | mà (but) |
| Sắc | Thanh sắc | ´ | Rising | má (mother) |
| Hỏi | Thanh hỏi | ̉ | Dipping (fall-rise) | mả (tomb) |
| Ngã | Thanh ngã | ˜ | Broken (rise-glottal-rise) | mã (horse) |
| Nặng | Thanh nặng | ̣ | Heavy, low, short | mạ (rice seedling) |

### B. Competitor Comparison

| Feature | Speak Phở Real | Duolingo | Pimsleur | ELSA |
|---------|---------------|----------|----------|------|
| Vietnamese | ✅ Focus | ✅ Basic | ✅ | ❌ |
| AI Conversation | ✅ | ❌ | ❌ | ❌ |
| Tone Visualization | ✅ | ❌ | ❌ | ✅ (English) |
| Custom Text | ✅ | ❌ | ❌ | ❌ |
| Karaoke Shadowing | ✅ | ❌ | ❌ | ❌ |
| Regional Accents | ✅ | ❌ | ❌ | N/A |

### C. Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Frontend | SvelteKit, TailwindCSS |
| Backend | Cloudflare Workers |
| Database | Cloudflare D1 |
| Storage | Cloudflare R2 |
| Cache | Cloudflare KV |
| Auth | Clerk |
| Payments | Stripe |
| AI Voice | OpenAI Realtime API |
| Pitch Detection | Pitchfinder.js |
| Analytics | TBD (Mixpanel/Amplitude) |
