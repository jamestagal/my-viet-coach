# Speak Phở Real — Structured Dialogues & Unique Feature Stack

> **Document Version:** 1.0  
> **Last Updated in Dec:** December 2024  
> **Status:** Content Planning

---

## Table of Contents

1. [Unique Feature Stack](#unique-feature-stack)
2. [Structured Dialogue Practice](#structured-dialogue-practice)
3. [Dialogue Scripts](#dialogue-scripts)
4. [Technical Implementation](#technical-implementation)

---

## Unique Feature Stack

### Summary: What Makes Speak Phở Real Different

Speak Phở Real combines **8 unique features** that no other Vietnamese learning app offers together. This creates a "practice-first" experience rather than a gamified course.

### The 8 Core Features

| # | Feature | Description | Unique Value |
|---|---------|-------------|--------------|
| 1 | **Tone Visualization** | See your pitch contour compared to native speaker | Only app showing Vietnamese tone graphs |
| 2 | **Custom Text Drills** | Paste ANY Vietnamese text to practice | "Bring Your Own" content — no curriculum lock-in |
| 3 | **Karaoke Shadowing** | Word-by-word highlighting while speaking along | Visual + audio guidance combined |
| 4 | **Structured Dialogues** | Scripted exchanges with AI playing one role | Bridge between drills and free conversation |
| 5 | **Speed Ladder** | Same sentence at 0.5x → 0.75x → 1.0x → 1.2x | Progressive speed mastery |
| 6 | **Regional Accent Toggle** | Switch between Northern (Hanoi) & Southern (Saigon) | Match family dialect or target region |
| 7 | **Problem Words Tracking** | AI identifies and tracks your weak spots | Personalized practice recommendations |
| 8 | **Free AI Conversation** | Unscripted real-time conversation with AI coach | Native speech-to-speech via OpenAI Realtime |

---

### Scaffolding Framework
You're describing a progressive speaking curriculum:
Level 1: Single Sounds
   ↓
Level 2: Single Words (minimal pairs)
   ↓
Level 3: Phrases (2-4 words)
   ↓
Level 4: Full Sentences
   ↓
Level 5: Structured Dialogues (scripted)
   ↓
Level 6: Free Conversation (AI improvises)

This is pedagogically sound — you don't throw someone into freeform conversation before they can produce the basic sounds.

### App Structure (4 Main Tabs)

LEARN — Structured lessons (tones, alphabet, phrases)
PRACTICE — Drill modes (custom text, curated drills, shadowing, dialogues)
TALK — Free AI conversation
PROFILE — Progress, settings, accent preference
---

### Feature Details

#### 1. 🎵 Tone Visualization

**What it does:** Displays a pitch contour graph comparing your pronunciation to the native speaker model.

**Why it matters:** Vietnamese has 6 tones that completely change word meaning. Most apps don't give visual feedback on tones — they just say "correct" or "incorrect." Seeing the actual pitch curve helps learners understand exactly what to fix.

**Technical approach:**
- Post-recording analysis using Pitchfinder.js
- Canvas/SVG visualization comparing two pitch contours
- Word-by-word tone scoring

```
┌─────────────────────────────────────────────────────────────────┐
│  PITCH COMPARISON                                               │
│                                                                 │
│  Model:  ──┐  ┌──╱  ───╲  ╱──  ───╱                            │
│            └──┘                                                 │
│                                                                 │
│  You:    ──┐  ┌───   ───╲  ╱──  ──╱                            │
│            └──┘  ▲                                              │
│               [Mismatch: should rise more]                      │
│                                                                 │
│           Tôi  đang  học  tiếng  Việt                          │
└─────────────────────────────────────────────────────────────────┘
```

---

#### 2. 📝 Custom Text Drills ("Bring Your Own")

**What it does:** Users paste any Vietnamese text (from textbooks, drama subtitles, song lyrics, news articles) and the app parses it into practiceable phrases.

**Why it matters:** Traditional apps lock you into their curriculum. With Custom Text, learners can practice content that's personally relevant — a message from a Vietnamese friend, a menu at their local phở restaurant, dialogue from a show they're watching.

**User flow:**
1. User pastes Vietnamese text
2. App parses into sentences
3. AI generates model pronunciation (OpenAI Realtime)
4. User practices with tone feedback

**Strategic value:** Low content burden (users bring content), high utility, maximum flexibility.

---

#### 3. 🎤 Karaoke Shadowing Mode (Listen + Speak Simultaneously + visual)

**What it does:** Combines shadowing technique with visual word highlighting — like karaoke for language learning. By adding karaoke-style word highlighting, learners get visual anchoring — they know exactly where they are in the sentence and can focus their cognitive load on production rather than tracking.

**Why it matters:** Pure audio shadowing (repeating right after native speaker) is cognitively demanding. Adding visual anchoring helps learners track where they are and builds rhythm/flow awareness.

**Three sub-modes:**

| Mode | Description | Best For |
|------|-------------|----------|
| **Listen First** | Hear with highlighting, then record | Beginners, first exposure |
| **Shadow Along** | Speak simultaneously while words highlight | Building rhythm & flow |
| **Record After** | Listen, pause, then record | Accuracy focus |

```
┌─────────────────────────────────────────────────────────────────┐
│  🎤 KARAOKE SHADOWING                                           │
│                                                                 │
│   Tôi   rất   [thích]   ăn   phở   Việt   Nam                  │
│               ^^^^^^^^                                          │
│            Currently playing                                    │
│                                                                 │
│   ═══════════════████░░░░░░░░░░░░░░░░░░░░░░░                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

#### 4. 💬 Structured Dialogue Practice

**What it does:** Scripted exchanges where AI plays one role (e.g., café staff) and user reads their lines (e.g., customer). User sees a scripted dialogue, reads their lines, AI evaluates pronunciation/tone in real-time or after completion. See [full dialogue library below](#structured-dialogue-practice).

**Why it matters:** Bridges the gap between isolated drills and free conversation. Users practice in realistic contexts with predictable patterns before jumping into unscripted chat.

**Features:**
- Line-by-line (Immediately after each line for Beginners, detailed correction) or full-dialogue (After completing entire exchange for Flow practice, intermediate+)feedback modes
- Post-dialogue breakdown with tone accuracy per line
- Scenario categories: Food, Shopping, Travel, Social, Work

┌─────────────────────────────────────────────────────────┐
│  📖 Dialogue: "At the Coffee Shop"                      │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 👤 Nhân viên: Chào anh, anh muốn uống gì ạ?       │  │
│  │              [AI speaks this line]                │  │
│  │                                                   │  │
│  │ 🎤 You: Cho tôi một ly cà phê sữa đá.             │  │  ← User reads
│  │         [Listening... 🔴]                         │  │
│  │                                                   │  │
│  │ 👤 Nhân viên: Dạ, anh muốn ít đường hay nhiều?   │  │
│  │              [AI speaks]                          │  │
│  │                                                   │  │
│  │ 🎤 You: Ít đường thôi. Bao nhiêu tiền?           │  │  ← User reads
│  │         [Your turn...]                            │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  [◀ Previous Line]  [Hear Again 🔊]  [Next Line ▶]     │
└─────────────────────────────────────────────────────────┘

### Post-Dialogue Feedback Screen

┌─────────────────────────────────────────────────────────┐
│  ✅ Dialogue Complete!                                  │
│                                                         │
│  Overall: ⭐⭐⭐⭐ (4/5)                                  │
│                                                         │
│  Line-by-line breakdown:                                │
│                                                         │
│  "Cho tôi một ly cà phê sữa đá"                        │
│   ├─ ✅ Cho tôi - Good!                                 │
│   ├─ ⚠️ một - Tone slightly flat (should be sharp /)   │
│   ├─ ✅ ly cà phê - Nice falling tone on "phê"         │
│   └─ ✅ sữa đá - Clear!                                 │
│                                                         │
│  "Ít đường thôi. Bao nhiêu tiền?"                      │
│   ├─ ✅ Ít đường - Perfect!                             │
│   └─ ⚠️ Bao nhiêu - "nhiêu" needs higher rise          │
│                                                         │
│  [🔁 Practice Again]  [📊 See Pitch Graph]  [Next →]   │
└─────────────────────────────────────────────────────────┘
---

#### 5. 🏃 Speed Ladder

**What it does:** Practice the same sentence at progressively faster speeds: 0.5x → 0.75x → 1.0x → 1.2x.

**Why it matters:** Native Vietnamese speech is fast. Learners need to build speed gradually while maintaining accuracy. The "unlock next speed" mechanic creates progression.

**Unlock rule:** 3 consecutive scores ≥85% to unlock next speed level.

```
┌─────────────────────────────────────────────────────────────────┐
│  🏃 SPEED LADDER                                                │
│                                                                 │
│  "Cảm ơn bạn rất nhiều"                                        │
│                                                                 │
│   🐢 0.5x   [███████████] ✅ Mastered                          │
│   🚶 0.75x  [███████░░░░] 70% — Current level                  │
│   🏃 1.0x   [░░░░░░░░░░░] 🔒 Locked                            │
│   🚀 1.2x   [░░░░░░░░░░░] 🔒 Locked                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

#### 6. 🗣️ Regional Accent Toggle

**What it does:** User selects Northern (Hanoi) or Southern (Saigon) accent preference. All model audio and feedback adjusts accordingly.

**Why it matters:** 
- Northern Vietnamese has 6 distinct tones
- Southern Vietnamese merges hỏi/ngã into 5 tones
- Heritage speakers often need to match their family's dialect
- Learners targeting a specific region need appropriate models

**Implementation:** All pre-recorded audio exists in both accents. User setting stored in profile.

---

#### 7. 📊 Problem Words Tracking

**What it does:** AI analyzes practice sessions and identifies words/sounds the user struggles with. These are surfaced for targeted practice.

**Why it matters:** Generic practice isn't efficient. If you always mess up "sữa" (milk) vs "sửa" (repair), the app should know and focus your practice there.

**Features:**
- Automatic detection from all practice modes
- "Words needing practice" section on home screen
- Quick drill generation from problem words
- Progress tracking as problems get resolved

---

#### 8. 🤖 Free AI Conversation

**What it does:** Unscripted real-time conversation with AI coach using OpenAI Realtime API. True speech-to-speech.

**Why it matters:** This is the "graduation" feature — where learners apply everything they've practiced in natural conversation. No typing, no scripts, just talking.

**Scenarios:**
- ☕ Coffee Shop
- 🍜 Restaurant  
- 🛍️ Market (bargaining)
- 🚕 Getting Around
- 🏠 Meeting Family
- 🗣️ Free Chat (any topic)

---

### Competitive Positioning

| Feature | Speak Phở Real | Duolingo | Pimsleur | ELSA | Jumpspeak |
|---------|---------------|----------|----------|------|-----------|
| Vietnamese focus | ✅ Primary | ✅ Basic | ✅ | ❌ | ✅ |
| AI Conversation | ✅ | ❌ | ❌ | ❌ | ✅ |
| Tone Visualization | ✅ | ❌ | ❌ | ✅ (English) | ❌ |
| Custom Text | ✅ | ❌ | ❌ | ❌ | ❌ |
| Karaoke Shadowing | ✅ | ❌ | ❌ | ❌ | ❌ |
| Regional Accents | ✅ | ❌ | ❌ | N/A | ❌ |

**Positioning statement:** "The only app that actually teaches you to hear the difference between mẹ and mẻ."

---

## Structured Dialogue Practice

### Overview

Structured dialogues bridge the gap between isolated phrase practice and free conversation. Each dialogue is a scripted exchange where the AI plays one role and the user speaks their assigned lines.

### Dialogue Levels

| Level | Stars | Turns | Vocabulary | Grammar | Description |
|-------|-------|-------|------------|---------|-------------|
| **Beginner** | ⭐ | 4-6 lines | Basic, high-frequency | Simple statements, questions | Essential survival scenarios |
| **Elementary** | ⭐⭐ | 6-8 lines | Expanded everyday | Numbers, prices, preferences | More complex transactions |
| **Intermediate** | ⭐⭐⭐ | 8-12 lines | Varied, some idioms | Past/future, conditionals | Social & professional contexts |

---

### Complete Dialogue Library (15 Dialogues)

#### ⭐ Beginner Dialogues (6)

| # | Title (VI) | Title (EN) | Topic | Lines | Description |
|---|------------|------------|-------|-------|-------------|
| 1 | Ly cà phê đầu tiên | First Coffee | 🍜 Food | 6 | Order coffee at a café |
| 2 | Một tô phở | A Bowl of Phở | 🍜 Food | 6 | Order phở, specify preferences |
| 3 | Đi Grab | Taking a Grab | ✈️ Travel | 6 | Tell driver destination |
| 4 | Ở đâu? | Where is it? | ✈️ Travel | 4 | Ask for directions |
| 5 | Gặp gỡ | Meeting Someone | 👋 Greetings | 6 | Meet someone, introduce yourself |
| 6 | Bao nhiêu? | How Much? | 🛍️ Shopping | 6 | Ask price, basic bargaining |

#### ⭐⭐ Elementary Dialogues (5)

| # | Title (VI) | Title (EN) | Topic | Lines | Description |
|---|------------|------------|-------|-------|-------------|
| 7 | Chợ Bến Thành | Bến Thành Market | 🛍️ Shopping | 8 | Bargain at the market |
| 8 | Đặt phòng khách sạn | Booking a Hotel | ✈️ Travel | 8 | Book a hotel room |
| 9 | Gọi món ở nhà hàng | Ordering at Restaurant | 🍜 Food | 8 | Full restaurant ordering |
| 10 | Gặp bạn | Meeting a Friend | 👨‍👩‍👧 Social | 8 | Catch up with a friend |
| 11 | Đổi tiền | Exchanging Money | 💼 Practical | 6 | Exchange currency |

#### ⭐⭐⭐ Intermediate Dialogues (4)

| # | Title (VI) | Title (EN) | Topic | Lines | Description |
|---|------------|------------|-------|-------|-------------|
| 12 | Ra mắt gia đình | Meeting the Family | 👨‍👩‍👧 Family | 10 | Meet partner's family |
| 13 | Hẹn đi chơi | Making Plans | 🎨 Social | 10 | Make plans, suggest activities |
| 14 | Ở bệnh viện | At the Hospital | 💼 Practical | 10 | Describe symptoms to doctor |
| 15 | Xin việc | Job Interview | 💼 Work | 12 | Job interview basics |

---

### Audio Requirements

| Level | Dialogues | Avg Lines | Total Lines | Audio Files (×2 accents) |
|-------|-----------|-----------|-------------|--------------------------|
| Beginner | 6 | 5.7 | 34 | 68 |
| Elementary | 5 | 7.6 | 38 | 76 |
| Intermediate | 4 | 10.5 | 42 | 84 |
| **Total** | **15** | | **114** | **228** |

---

## Dialogue Scripts

### Dialogue 1: Ly cà phê đầu tiên (First Coffee) ⭐

**Scenario:** Ordering coffee at a Vietnamese café  
**Your role:** Customer  
**AI role:** Nhân viên (Staff)  
**Difficulty:** ⭐ Beginner  
**Lines:** 6

| Line | Speaker | Vietnamese | English |
|------|---------|------------|---------|
| 1 | 👤 Staff | Chào anh, anh muốn uống gì ạ? | Hello sir, what would you like to drink? |
| 2 | 🎤 You | Cho tôi một ly cà phê sữa đá. | Give me an iced coffee with milk. |
| 3 | 👤 Staff | Dạ, anh muốn ít đường hay nhiều đường? | Would you like less sugar or more sugar? |
| 4 | 🎤 You | Ít đường thôi. | Less sugar please. |
| 5 | 👤 Staff | Dạ, hai mươi nghìn ạ. | That's 20,000 dong. |
| 6 | 🎤 You | Đây. Cảm ơn. | Here you go. Thank you. |

**Key vocabulary:**
- cà phê sữa đá = iced coffee with milk
- ít đường = less sugar
- hai mươi nghìn = 20,000

---

### Dialogue 2: Một tô phở (A Bowl of Phở) ⭐

**Scenario:** Ordering phở at a restaurant  
**Your role:** Customer  
**AI role:** Server  
**Difficulty:** ⭐ Beginner  
**Lines:** 6

| Line | Speaker | Vietnamese | English |
|------|---------|------------|---------|
| 1 | 👤 Server | Anh muốn ăn gì? | What would you like to eat? |
| 2 | 🎤 You | Cho tôi một tô phở bò. | Give me a beef phở. |
| 3 | 👤 Server | Tái hay chín? | Rare or well-done (beef)? |
| 4 | 🎤 You | Tái, cảm ơn. | Rare, thank you. |
| 5 | 👤 Server | Anh có muốn thêm gì không? | Would you like anything else? |
| 6 | 🎤 You | Không, đủ rồi. Cảm ơn. | No, that's enough. Thank you. |

**Key vocabulary:**
- tô phở bò = bowl of beef phở
- tái = rare (meat)
- chín = well-done (meat)

---

### Dialogue 3: Đi Grab (Taking a Grab) ⭐

**Scenario:** Getting a Grab ride  
**Your role:** Passenger  
**AI role:** Driver  
**Difficulty:** ⭐ Beginner  
**Lines:** 6

| Line | Speaker | Vietnamese | English |
|------|---------|------------|---------|
| 1 | 👤 Driver | Chào anh, anh đi đâu? | Hello, where are you going? |
| 2 | 🎤 You | Tôi muốn đi Bến Thành. | I want to go to Bến Thành. |
| 3 | 👤 Driver | Dạ được, khoảng mười lăm phút. | OK, about 15 minutes. |
| 4 | 🎤 You | Được, cảm ơn. | OK, thank you. |
| 5 | 👤 Driver | Đến rồi. | We've arrived. |
| 6 | 🎤 You | Cảm ơn anh. Tạm biệt! | Thank you. Goodbye! |

**Key vocabulary:**
- đi đâu = where are you going
- khoảng = about/approximately
- đến rồi = arrived

---

### Dialogue 4: Ở đâu? (Where is it?) ⭐

**Scenario:** Asking for directions  
**Your role:** Tourist  
**AI role:** Local person  
**Difficulty:** ⭐ Beginner  
**Lines:** 4

| Line | Speaker | Vietnamese | English |
|------|---------|------------|---------|
| 1 | 🎤 You | Xin lỗi, nhà vệ sinh ở đâu? | Excuse me, where is the toilet? |
| 2 | 👤 Local | Đi thẳng, rồi rẽ trái. | Go straight, then turn left. |
| 3 | 🎤 You | Cảm ơn nhiều! | Thank you very much! |
| 4 | 👤 Local | Không có gì! | You're welcome! |

**Key vocabulary:**
- nhà vệ sinh = toilet/bathroom
- đi thẳng = go straight
- rẽ trái = turn left

---

### Dialogue 5: Gặp gỡ (Meeting Someone) ⭐

**Scenario:** Meeting someone new  
**Your role:** Yourself  
**AI role:** New acquaintance  
**Difficulty:** ⭐ Beginner  
**Lines:** 6

| Line | Speaker | Vietnamese | English |
|------|---------|------------|---------|
| 1 | 👤 Person | Xin chào! Tôi tên là Lan. | Hello! My name is Lan. |
| 2 | 🎤 You | Chào Lan! Tôi tên là [name]. | Hello Lan! My name is [name]. |
| 3 | 👤 Person | Rất vui được gặp. Anh đến từ đâu? | Nice to meet you. Where are you from? |
| 4 | 🎤 You | Tôi đến từ Úc. | I'm from Australia. |
| 5 | 👤 Person | Ồ, hay quá! Anh nói tiếng Việt giỏi! | Oh, how nice! You speak Vietnamese well! |
| 6 | 🎤 You | Cảm ơn, tôi đang học. | Thank you, I'm still learning. |

**Key vocabulary:**
- rất vui được gặp = nice to meet you
- đến từ đâu = where are you from
- đang học = still learning

---

### Dialogue 6: Bao nhiêu? (How Much?) ⭐

**Scenario:** Asking prices at a shop  
**Your role:** Customer  
**AI role:** Shop owner  
**Difficulty:** ⭐ Beginner  
**Lines:** 6

| Line | Speaker | Vietnamese | English |
|------|---------|------------|---------|
| 1 | 🎤 You | Xin chào, cái này bao nhiêu tiền? | Hello, how much is this? |
| 2 | 👤 Owner | Cái này năm mươi nghìn. | This one is 50,000. |
| 3 | 🎤 You | Đắt quá! Bớt được không? | Too expensive! Can you reduce it? |
| 4 | 👤 Owner | Được, bốn mươi nghìn. | OK, 40,000. |
| 5 | 🎤 You | Được rồi, tôi lấy cái này. | OK, I'll take this one. |
| 6 | 👤 Owner | Cảm ơn anh! | Thank you! |

**Key vocabulary:**
- bao nhiêu tiền = how much money
- đắt quá = too expensive
- bớt được không = can you reduce the price

---

### Dialogue 7: Chợ Bến Thành (Bến Thành Market) ⭐⭐

**Scenario:** Bargaining at the famous market  
**Your role:** Tourist/Customer  
**AI role:** Market vendor  
**Difficulty:** ⭐⭐ Elementary  
**Lines:** 8

| Line | Speaker | Vietnamese | English |
|------|---------|------------|---------|
| 1 | 👤 Vendor | Mua gì đi anh! Áo đẹp lắm! | Buy something! Beautiful shirts! |
| 2 | 🎤 You | Cho tôi xem cái áo này. | Let me see this shirt. |
| 3 | 👤 Vendor | Cái này hai trăm nghìn. | This one is 200,000. |
| 4 | 🎤 You | Đắt quá! Một trăm được không? | Too expensive! How about 100,000? |
| 5 | 👤 Vendor | Không được đâu! Một trăm năm mươi. | No way! 150,000. |
| 6 | 🎤 You | Một trăm hai mươi, được không? | 120,000, OK? |
| 7 | 👤 Vendor | Thôi được, lấy đi. | Fine, take it. |
| 8 | 🎤 You | Cảm ơn! Cho tôi cái màu xanh. | Thanks! Give me the blue one. |

**Key vocabulary:**
- mua gì đi = buy something (invitation)
- hai trăm nghìn = 200,000
- màu xanh = blue color

---

### Dialogue 8: Đặt phòng khách sạn (Booking a Hotel) ⭐⭐

**Scenario:** Checking into a hotel  
**Your role:** Guest  
**AI role:** Receptionist  
**Difficulty:** ⭐⭐ Elementary  
**Lines:** 8

| Line | Speaker | Vietnamese | English |
|------|---------|------------|---------|
| 1 | 👤 Reception | Xin chào, tôi có thể giúp gì? | Hello, how can I help you? |
| 2 | 🎤 You | Tôi muốn đặt phòng. | I'd like to book a room. |
| 3 | 👤 Reception | Anh muốn ở mấy đêm? | How many nights would you like to stay? |
| 4 | 🎤 You | Hai đêm, từ hôm nay. | Two nights, starting today. |
| 5 | 👤 Reception | Anh muốn phòng đơn hay phòng đôi? | Would you like a single or double room? |
| 6 | 🎤 You | Phòng đôi, có cửa sổ. | A double room with a window. |
| 7 | 👤 Reception | Dạ được. Một triệu hai cho hai đêm. | OK. 1.2 million for two nights. |
| 8 | 🎤 You | Được, tôi lấy phòng này. | OK, I'll take this room. |

**Key vocabulary:**
- đặt phòng = book a room
- mấy đêm = how many nights
- phòng đơn/đôi = single/double room

---

### Dialogue 9: Gọi món ở nhà hàng (Ordering at Restaurant) ⭐⭐

**Scenario:** Full restaurant ordering experience  
**Your role:** Customer  
**AI role:** Waiter  
**Difficulty:** ⭐⭐ Elementary  
**Lines:** 8

| Line | Speaker | Vietnamese | English |
|------|---------|------------|---------|
| 1 | 👤 Waiter | Xin chào, đây là thực đơn. | Hello, here's the menu. |
| 2 | 🎤 You | Cảm ơn. Cho tôi xem... | Thank you. Let me see... |
| 3 | 👤 Waiter | Anh đã chọn xong chưa? | Have you decided? |
| 4 | 🎤 You | Rồi. Cho tôi một phần cơm sườn. | Yes. Give me a grilled pork rice. |
| 5 | 👤 Waiter | Anh muốn uống gì? | What would you like to drink? |
| 6 | 🎤 You | Một chai nước suối. | A bottle of mineral water. |
| 7 | 👤 Waiter | Dạ, còn gì nữa không ạ? | Anything else? |
| 8 | 🎤 You | Không, đủ rồi. Cảm ơn. | No, that's enough. Thanks. |

**Key vocabulary:**
- thực đơn = menu
- cơm sườn = grilled pork with rice
- nước suối = mineral water

---

### Dialogue 10: Gặp bạn (Meeting a Friend) ⭐⭐

**Scenario:** Catching up with a Vietnamese friend  
**Your role:** You  
**AI role:** Friend (Minh)  
**Difficulty:** ⭐⭐ Elementary  
**Lines:** 8

| Line | Speaker | Vietnamese | English |
|------|---------|------------|---------|
| 1 | 👤 Minh | Ê, lâu rồi không gặp! | Hey, long time no see! |
| 2 | 🎤 You | Ừ, lâu quá! Dạo này sao rồi? | Yeah, so long! How have you been? |
| 3 | 👤 Minh | Bình thường thôi. Còn anh? | Just normal. And you? |
| 4 | 🎤 You | Tôi khỏe. Đang học tiếng Việt. | I'm good. I'm learning Vietnamese. |
| 5 | 👤 Minh | Hay quá! Nói giỏi lắm! | Great! You speak very well! |
| 6 | 🎤 You | Cảm ơn, nhưng còn kém lắm. | Thanks, but I'm still not very good. |
| 7 | 👤 Minh | Đi uống cà phê không? | Want to go get coffee? |
| 8 | 🎤 You | Được! Đi thôi! | Sure! Let's go! |

**Key vocabulary:**
- lâu rồi không gặp = long time no see
- dạo này sao rồi = how have you been lately
- đi thôi = let's go

---

### Dialogue 11: Đổi tiền (Exchanging Money) ⭐⭐

**Scenario:** At a currency exchange  
**Your role:** Customer  
**AI role:** Teller  
**Difficulty:** ⭐⭐ Elementary  
**Lines:** 6

| Line | Speaker | Vietnamese | English |
|------|---------|------------|---------|
| 1 | 🎤 You | Xin chào, tôi muốn đổi tiền. | Hello, I'd like to exchange money. |
| 2 | 👤 Teller | Anh muốn đổi tiền gì? | What currency do you want to exchange? |
| 3 | 🎤 You | Đô la Úc sang tiền Việt. | Australian dollars to Vietnamese dong. |
| 4 | 👤 Teller | Hôm nay tỷ giá là mười sáu nghìn. | Today's rate is 16,000. |
| 5 | 🎤 You | Được, tôi đổi một trăm đô la. | OK, I'll exchange 100 dollars. |
| 6 | 👤 Teller | Dạ, đây là một triệu sáu trăm nghìn. | Here's 1.6 million dong. |

**Key vocabulary:**
- đổi tiền = exchange money
- tỷ giá = exchange rate
- đô la Úc = Australian dollar

---

### Dialogue 12: Ra mắt gia đình (Meeting the Family) ⭐⭐⭐

**Scenario:** Meeting your partner's Vietnamese family  
**Your role:** Guest/Partner  
**AI role:** Family members  
**Difficulty:** ⭐⭐⭐ Intermediate  
**Lines:** 10

| Line | Speaker | Vietnamese | English |
|------|---------|------------|---------|
| 1 | 👤 Mother | Chào con, vào nhà đi! | Hello dear, come inside! |
| 2 | 🎤 You | Dạ, chào bác. Cảm ơn bác. | Hello auntie. Thank you. |
| 3 | 👤 Father | Con ngồi đi. Uống trà nhé? | Sit down. Would you like some tea? |
| 4 | 🎤 You | Dạ, cảm ơn bác. Con xin một ly. | Thank you, uncle. I'd like one. |
| 5 | 👤 Mother | Con làm nghề gì? | What do you do for work? |
| 6 | 🎤 You | Dạ, con là giáo viên ạ. | I'm a teacher. |
| 7 | 👤 Father | Hay quá! Con học tiếng Việt ở đâu? | How nice! Where did you learn Vietnamese? |
| 8 | 🎤 You | Dạ, con tự học và dùng ứng dụng. | I self-studied and used an app. |
| 9 | 👤 Mother | Giỏi quá! Ở lại ăn cơm nhé! | So good! Stay for dinner! |
| 10 | 🎤 You | Dạ, cảm ơn bác. Con rất vui. | Thank you, auntie. I'm very happy. |

**Key vocabulary:**
- bác = uncle/aunt (polite for parents' generation)
- con = I (humble, when speaking to elders)
- ở lại ăn cơm = stay for dinner

**Cultural note:** Using "con" and "bác" shows respect. The guest should be humble and gracious.

---

### Dialogue 13: Hẹn đi chơi (Making Plans) ⭐⭐⭐

**Scenario:** Making weekend plans with a friend  
**Your role:** You  
**AI role:** Friend  
**Difficulty:** ⭐⭐⭐ Intermediate  
**Lines:** 10

| Line | Speaker | Vietnamese | English |
|------|---------|------------|---------|
| 1 | 🎤 You | Cuối tuần này bạn có rảnh không? | Are you free this weekend? |
| 2 | 👤 Friend | Có, sao vậy? | Yes, why? |
| 3 | 🎤 You | Mình muốn đi chơi. Bạn có muốn đi không? | I want to go out. Do you want to come? |
| 4 | 👤 Friend | Đi đâu vậy? | Go where? |
| 5 | 🎤 You | Có thể đi ăn, rồi xem phim. | Maybe eat, then watch a movie. |
| 6 | 👤 Friend | Hay quá! Mấy giờ gặp? | Great! What time should we meet? |
| 7 | 🎤 You | Khoảng sáu giờ chiều được không? | Around 6pm OK? |
| 8 | 👤 Friend | Được. Gặp ở đâu? | OK. Where should we meet? |
| 9 | 🎤 You | Gặp ở quán cà phê gần rạp phim nhé. | Let's meet at the café near the cinema. |
| 10 | 👤 Friend | OK, hẹn gặp cuối tuần! | OK, see you on the weekend! |

**Key vocabulary:**
- cuối tuần = weekend
- rảnh = free (available)
- rạp phim = cinema

---

### Dialogue 14: Ở bệnh viện (At the Hospital) ⭐⭐⭐

**Scenario:** Describing symptoms to a doctor  
**Your role:** Patient  
**AI role:** Doctor  
**Difficulty:** ⭐⭐⭐ Intermediate  
**Lines:** 10

| Line | Speaker | Vietnamese | English |
|------|---------|------------|---------|
| 1 | 👤 Doctor | Chào anh, anh bị sao? | Hello, what's wrong? |
| 2 | 🎤 You | Dạ, tôi bị đau đầu và sốt. | I have a headache and fever. |
| 3 | 👤 Doctor | Bị từ khi nào? | Since when? |
| 4 | 🎤 You | Từ hôm qua, tối qua nặng hơn. | Since yesterday, worse last night. |
| 5 | 👤 Doctor | Anh có ho không? | Do you have a cough? |
| 6 | 🎤 You | Có, ho một chút. Và đau họng. | Yes, a little cough. And sore throat. |
| 7 | 👤 Doctor | Để tôi khám. Anh há miệng ra. | Let me examine. Open your mouth. |
| 8 | 🎤 You | Dạ. | OK. |
| 9 | 👤 Doctor | Anh bị cảm. Uống thuốc và nghỉ ngơi. | You have a cold. Take medicine and rest. |
| 10 | 🎤 You | Cảm ơn bác sĩ. Tôi mua thuốc ở đâu? | Thank you doctor. Where do I buy medicine? |

**Key vocabulary:**
- đau đầu = headache
- sốt = fever
- ho = cough
- đau họng = sore throat
- bị cảm = have a cold

---

### Dialogue 15: Xin việc (Job Interview) ⭐⭐⭐

**Scenario:** Basic job interview  
**Your role:** Candidate  
**AI role:** Interviewer  
**Difficulty:** ⭐⭐⭐ Intermediate  
**Lines:** 12

| Line | Speaker | Vietnamese | English |
|------|---------|------------|---------|
| 1 | 👤 Interviewer | Xin chào, mời anh ngồi. | Hello, please sit down. |
| 2 | 🎤 You | Cảm ơn. Xin chào. | Thank you. Hello. |
| 3 | 👤 Interviewer | Anh tên gì? | What's your name? |
| 4 | 🎤 You | Dạ, tôi tên là [name]. | My name is [name]. |
| 5 | 👤 Interviewer | Anh có kinh nghiệm gì? | What experience do you have? |
| 6 | 🎤 You | Tôi có ba năm kinh nghiệm làm giáo viên. | I have 3 years experience as a teacher. |
| 7 | 👤 Interviewer | Tại sao anh muốn làm ở đây? | Why do you want to work here? |
| 8 | 🎤 You | Vì tôi thích công ty này và muốn học hỏi thêm. | Because I like this company and want to learn more. |
| 9 | 👤 Interviewer | Điểm mạnh của anh là gì? | What are your strengths? |
| 10 | 🎤 You | Tôi làm việc chăm chỉ và học nhanh. | I work hard and learn quickly. |
| 11 | 👤 Interviewer | Được rồi. Chúng tôi sẽ liên lạc sau. | OK. We'll contact you later. |
| 12 | 🎤 You | Cảm ơn. Tôi rất mong được làm việc ở đây. | Thank you. I really hope to work here. |

**Key vocabulary:**
- kinh nghiệm = experience
- công ty = company
- điểm mạnh = strength
- chăm chỉ = hardworking

---

## Technical Implementation

### Data Model

```typescript
interface Dialogue {
  id: string;
  title_vi: string;
  title_en: string;
  category: 'food' | 'travel' | 'shopping' | 'social' | 'family' | 'practical' | 'work';
  difficulty: 1 | 2 | 3;
  description: string;
  user_role: string;
  ai_role: string;
  lines: DialogueLine[];
  key_vocabulary: VocabItem[];
  cultural_notes?: string;
  estimated_minutes: number;
}

interface DialogueLine {
  index: number;
  speaker: 'user' | 'ai';
  text_vi: string;
  text_en: string;
  audio_northern: string; // R2 URL
  audio_southern: string; // R2 URL
  pitch_contour: number[];
  hints?: string[];
}

interface VocabItem {
  word: string;
  meaning: string;
  example?: string;
}
```

### UI Flow

```
┌──────────────────┐
│ Select Dialogue  │
│ from Library     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Preview:         │
│ - Description    │
│ - Your role      │
│ - Difficulty     │
│ [Start Practice] │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│ AI speaks line   │ ──▶ │ You speak your   │
│ (with subtitles) │     │ line (recording) │
└──────────────────┘     └────────┬─────────┘
         ▲                        │
         │                        ▼
         │               ┌──────────────────┐
         │               │ Instant feedback │
         │               │ on your line     │
         │               └────────┬─────────┘
         │                        │
         └────────────────────────┘
                    (repeat for all lines)
                          │
                          ▼
               ┌──────────────────┐
               │ Completion:      │
               │ - Overall score  │
               │ - Line breakdown │
               │ - Problem words  │
               │ [Practice Again] │
               │ [Next Dialogue]  │
               └──────────────────┘
```

### Scoring

| Metric | Weight | Description |
|--------|--------|-------------|
| Tone accuracy | 50% | Did you hit the right tones? |
| Pronunciation | 30% | Clear consonants/vowels? |
| Fluency | 20% | Natural pacing and flow? |

**Overall dialogue score** = Average of all user line scores

---

## Recording Checklist

### Audio Files Needed

- [ ] 114 dialogue lines in Northern accent
- [ ] 114 dialogue lines in Southern accent
- [ ] Total: 228 audio files

### File Naming Convention

```
dialogue_{number}_{line}_{speaker}_{accent}.mp3

Examples:
- dialogue_01_line01_ai_northern.mp3
- dialogue_01_line02_user_northern.mp3
- dialogue_07_line05_ai_southern.mp3
```

### Quality Standards

| Spec | Requirement |
|------|-------------|
| Format | MP3 (128kbps) |
| Sample Rate | 44.1kHz |
| Channels | Mono |
| Normalization | -3dB peak |
| Silence | 200ms padding |
| Noise floor | < -50dB |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Dec 2024 | Initial 15 dialogues + 8 unique features |

---

*This document is part of the Speak Phở Real Vietnamese learning app.*
