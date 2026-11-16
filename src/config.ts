import { z } from 'zod';

export type RealProvider = 'openai' | 'anthropic';
export type ProviderName = RealProvider | 'mock';

const boolish = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  AI_PROVIDER: z.enum(['mock', 'openai', 'anthropic']).optional(),
  AI_FALLBACK_PROVIDER: z.enum(['openai', 'anthropic', 'none']).optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().min(1).default('gpt-5.4-mini'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().min(1).default('claude-haiku-4-5'),
  MOCK_PRIMARY_INVALID: boolish,
  API_KEY: z.string().optional(),
  OTEL_TRACES_EXPORTER: z.enum(['console', 'otlp', 'none']).default('console'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
  OTEL_SERVICE_NAME: z.string().min(1).default('voicedesk-insights'),
});

export interface AiConfig {
  primary: ProviderName;
  fallback: RealProvider | null;
  openai: { apiKey?: string; model: string };
  anthropic: { apiKey?: string; model: string };
  mockPrimaryInvalid: boolean;
}

export interface Config {
  databaseUrl?: string;
  port: number;
  apiKey?: string;
  ai: AiConfig;
  telemetry: {
    exporter: 'console' | 'otlp' | 'none';
    otlpEndpoint?: string;
    serviceName: string;
  };
}

const nonEmpty = (v: string | undefined): string | undefined => (v && v.trim() ? v.trim() : undefined);

/**
 * Builds the config from a plain env record (process.env on Node, bindings on Workers), so nothing
 * here touches `process`. Throws with a readable message when a chosen provider has no key.
 */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const e = EnvSchema.parse(env);
  const keys: Record<RealProvider, string | undefined> = {
    openai: nonEmpty(e.OPENAI_API_KEY),
    anthropic: nonEmpty(e.ANTHROPIC_API_KEY),
  };

  // No explicit provider: use a real one only when its key exists, otherwise MOCK mode.
  const primary: ProviderName = e.AI_PROVIDER ?? (keys.openai ? 'openai' : keys.anthropic ? 'anthropic' : 'mock');
  if (primary !== 'mock' && !keys[primary]) {
    throw new Error(`AI_PROVIDER=${primary} but ${primary.toUpperCase()}_API_KEY is not set`);
  }

  let fallback: RealProvider | null = null;
  if (primary !== 'mock') {
    if (e.AI_FALLBACK_PROVIDER === 'none') {
      fallback = null;
    } else if (e.AI_FALLBACK_PROVIDER) {
      if (!keys[e.AI_FALLBACK_PROVIDER]) {
        throw new Error(
          `AI_FALLBACK_PROVIDER=${e.AI_FALLBACK_PROVIDER} but ${e.AI_FALLBACK_PROVIDER.toUpperCase()}_API_KEY is not set`,
        );
      }
      fallback = e.AI_FALLBACK_PROVIDER;
    } else {
      const other: RealProvider = primary === 'openai' ? 'anthropic' : 'openai';
      fallback = keys[other] ? other : null;
    }
  }

  return {
    databaseUrl: nonEmpty(e.DATABASE_URL),
    port: e.PORT,
    apiKey: nonEmpty(e.API_KEY),
    ai: {
      primary,
      fallback,
      openai: { apiKey: keys.openai, model: e.OPENAI_MODEL },
      anthropic: { apiKey: keys.anthropic, model: e.ANTHROPIC_MODEL },
      mockPrimaryInvalid: e.MOCK_PRIMARY_INVALID,
    },
    telemetry: {
      exporter: e.OTEL_TRACES_EXPORTER,
      otlpEndpoint: e.OTEL_EXPORTER_OTLP_ENDPOINT,
      serviceName: e.OTEL_SERVICE_NAME,
    },
  };
}
