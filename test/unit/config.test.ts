import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

describe('loadConfig', () => {
  it('falls back to MOCK mode when no provider and no keys are set', () => {
    const c = loadConfig({});
    expect(c.ai.primary).toBe('mock');
    expect(c.ai.fallback).toBeNull();
    expect(c.port).toBe(8787);
    expect(c.telemetry.exporter).toBe('console');
  });

  it('picks the provider whose key exists and the other one as fallback', () => {
    const c = loadConfig({ OPENAI_API_KEY: 'sk-test', ANTHROPIC_API_KEY: 'ak-test' });
    expect(c.ai.primary).toBe('openai');
    expect(c.ai.fallback).toBe('anthropic');
  });

  it('honours AI_PROVIDER=anthropic and defaults fallback to openai when that key exists', () => {
    const c = loadConfig({ AI_PROVIDER: 'anthropic', OPENAI_API_KEY: 'sk', ANTHROPIC_API_KEY: 'ak' });
    expect(c.ai).toMatchObject({ primary: 'anthropic', fallback: 'openai' });
  });

  it('has no fallback when only one key is set', () => {
    expect(loadConfig({ ANTHROPIC_API_KEY: 'ak' }).ai).toMatchObject({ primary: 'anthropic', fallback: null });
  });

  it('AI_FALLBACK_PROVIDER=none disables the fallback', () => {
    const c = loadConfig({ OPENAI_API_KEY: 'sk', ANTHROPIC_API_KEY: 'ak', AI_FALLBACK_PROVIDER: 'none' });
    expect(c.ai.fallback).toBeNull();
  });

  it('rejects a provider without its key', () => {
    expect(() => loadConfig({ AI_PROVIDER: 'openai' })).toThrow(/OPENAI_API_KEY/);
    expect(() => loadConfig({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk', AI_FALLBACK_PROVIDER: 'anthropic' })).toThrow(
      /ANTHROPIC_API_KEY/,
    );
  });

  it('treats blank keys as unset', () => {
    expect(loadConfig({ OPENAI_API_KEY: '   ' }).ai.primary).toBe('mock');
  });

  it('parses telemetry, port, api key and the mock failure switch', () => {
    const c = loadConfig({
      PORT: '9000',
      API_KEY: 'secret',
      MOCK_PRIMARY_INVALID: 'true',
      OTEL_TRACES_EXPORTER: 'otlp',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
    });
    expect(c.port).toBe(9000);
    expect(c.apiKey).toBe('secret');
    expect(c.ai.mockPrimaryInvalid).toBe(true);
    expect(c.telemetry).toMatchObject({ exporter: 'otlp', otlpEndpoint: 'http://localhost:4318' });
  });

  it('rejects invalid values', () => {
    expect(() => loadConfig({ OTEL_TRACES_EXPORTER: 'jaeger' })).toThrow();
    expect(() => loadConfig({ PORT: '0' })).toThrow();
  });
});
