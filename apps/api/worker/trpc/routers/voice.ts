/**
 * Voice Token tRPC Router
 * Provides ephemeral tokens for Gemini and OpenAI voice APIs
 */

import { z } from "zod";
import { t } from "../trpc-instance";

const voiceProviderSchema = z.enum(["gemini", "openai"]);

export const voiceTrpcRoutes = t.router({
  /**
   * Get an ephemeral token for voice API connection
   * 
   * Usage from frontend:
   * const { token, provider, expiresIn } = await trpc.voice.getToken.mutate({ provider: 'gemini' });
   */
  getToken: t.procedure
    .input(z.object({
      provider: voiceProviderSchema,
    }))
    .mutation(async ({ input, ctx }) => {
      const { provider } = input;
      
      // TODO: Add authentication check
      // if (!ctx.userInfo.userId || ctx.userInfo.userId === 'anonymous') {
      //   throw new Error('Unauthorized');
      // }

      if (provider === "gemini") {
        // Gemini: Return API key directly
        // Note: In production, consider using a proxy or scoped key
        const apiKey = ctx.env.GOOGLE_API_KEY;
        
        if (!apiKey) {
          throw new Error("GOOGLE_API_KEY not configured");
        }
        
        return {
          token: apiKey,
          provider: "gemini" as const,
          expiresIn: 900, // 15 minutes (Gemini session limit)
        };
      } else {
        // OpenAI: Create ephemeral session token
        const apiKey = ctx.env.OPENAI_API_KEY;
        
        if (!apiKey) {
          throw new Error("OPENAI_API_KEY not configured");
        }

        const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-realtime-preview",
            voice: "coral",
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error("OpenAI session creation failed:", error);
          throw new Error("Failed to create OpenAI session");
        }

        const data = await response.json() as { client_secret: { value: string } };
        
        return {
          token: data.client_secret.value,
          provider: "openai" as const,
          expiresIn: 60, // OpenAI ephemeral tokens last 1 minute
        };
      }
    }),

  /**
   * Get available voice providers and their status
   * Useful for showing which providers are configured
   */
  getProviders: t.procedure.query(({ ctx }) => {
    return {
      gemini: {
        available: !!ctx.env.GOOGLE_API_KEY,
        sessionLimit: 900, // 15 minutes
      },
      openai: {
        available: !!ctx.env.OPENAI_API_KEY,
        sessionLimit: 1800, // ~30 minutes
      },
    };
  }),
});
