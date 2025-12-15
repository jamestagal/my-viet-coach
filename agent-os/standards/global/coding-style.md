# Coding Style - Speak Phở Real

Standards for writing clean, consistent TypeScript and Svelte code.

## TypeScript Conventions

- **Strict Mode:** Always use TypeScript strict mode; avoid `any` types
- **Type Inference:** Let TypeScript infer types where obvious; explicit types for function parameters and return values
- **Interfaces over Types:** Prefer `interface` for object shapes, `type` for unions and complex types
- **Const Assertions:** Use `as const` for literal types and readonly arrays

```typescript
// Good
interface User {
  id: string;
  name: string;
  email: string;
}

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

// Avoid
const user: any = {};
```

## Naming Conventions

- **Variables/Functions:** camelCase (`userId`, `startSession`)
- **Types/Interfaces:** PascalCase (`VoiceProvider`, `SessionConfig`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_SESSION_MINUTES`, `API_BASE_URL`)
- **Files:** kebab-case for routes (`+page.svelte`), PascalCase for classes (`VoiceClient.ts`)
- **Database columns:** snake_case (`user_id`, `created_at`)

## Svelte 5 Runes

- **Use Runes:** Prefer `$state`, `$derived`, `$effect` over legacy reactive syntax
- **Explicit State:** Declare reactive state at the top of `<script>` blocks
- **Minimal Effects:** Avoid `$effect` when `$derived` suffices

```svelte
<script lang="ts">
  // State declarations at top
  let count = $state(0);
  let doubled = $derived(count * 2);

  // Functions below state
  function increment() {
    count++;
  }
</script>
```

## Function Style

- **Arrow Functions:** For callbacks and short functions
- **Named Functions:** For component methods and exported functions
- **Async/Await:** Always use async/await over .then() chains
- **Early Returns:** Return early to reduce nesting

```typescript
// Good
async function fetchUser(id: string): Promise<User | null> {
  if (!id) return null;

  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) return null;

  return response.json();
}
```

## Import Organization

Order imports consistently:
1. Svelte imports (`svelte`, `svelte/store`)
2. SvelteKit imports (`$app/*`, `$env/*`)
3. Third-party packages
4. Local modules (`$lib/*`)
5. Types (with `type` keyword)

```typescript
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { Mic, Phone } from 'lucide-svelte';
import { VoiceClient } from '$lib/voice/VoiceClient';
import type { User } from '$lib/types';
```

## General Best Practices

- **Small Functions:** Keep functions under 30 lines; extract helpers
- **Single Responsibility:** One purpose per file/function
- **No Dead Code:** Remove unused imports, variables, and commented code
- **DRY Principle:** Extract common logic into reusable functions
- **No Backward Compatibility Hacks:** Unless instructed, don't add compatibility shims

## Formatting (Prettier)

- **Indentation:** 2 spaces
- **Quotes:** Single quotes for strings
- **Semicolons:** Required
- **Trailing Commas:** Yes, in multiline structures
- **Line Length:** 100 characters max
