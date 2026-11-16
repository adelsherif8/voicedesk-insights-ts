import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import type { Config } from '../config.js';

/**
 * Registers a global tracer provider for the Node server. Spans come from three places:
 * the Hono HTTP middleware (@hono/otel), the insight attempt spans in insights/generate.ts,
 * and the AI SDK's own spans via @ai-sdk/otel. Exporter: console (default), OTLP/HTTP, or none.
 */
export function startTelemetry(cfg: Config['telemetry']): { shutdown: () => Promise<void> } {
  if (cfg.exporter === 'none') return { shutdown: async () => {} };

  let processor: SpanProcessor;
  if (cfg.exporter === 'otlp') {
    const url = cfg.otlpEndpoint ? `${cfg.otlpEndpoint.replace(/\/$/, '')}/v1/traces` : undefined;
    processor = new BatchSpanProcessor(new OTLPTraceExporter(url ? { url } : {}));
  } else {
    processor = new SimpleSpanProcessor(new ConsoleSpanExporter());
  }

  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: cfg.serviceName }),
    spanProcessors: [processor],
  });
  provider.register();
  return { shutdown: () => provider.shutdown() };
}
