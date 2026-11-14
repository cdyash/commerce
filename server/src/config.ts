import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from cwd or candidate locations
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server/.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../.env'),
];
for (const p of envCandidates) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

export const ScopeSchema = z.enum([
  'catalog:read',
  'cart:write',
  'checkout:create',
  'orders:read',
]);
export type Scope = z.infer<typeof ScopeSchema>;

export interface AgentTokenConfig {
  name: string;
  token: string;
  scopes: Scope[];
}

const rawEnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ADMIN_KEY: z.string().min(1, 'ADMIN_KEY is required and must not be empty'),
  DEV_TOOLS: z
    .string()
    .optional()
    .default('false')
    .transform((val) => val === 'true' || val === '1'),
  AGENT_TOKENS: z.string().min(1, 'AGENT_TOKENS is required'),
  RAZORPAY_KEY_ID: z.string().min(1, 'RAZORPAY_KEY_ID is required'),
  RAZORPAY_KEY_SECRET: z.string().min(1, 'RAZORPAY_KEY_SECRET is required'),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1, 'RAZORPAY_WEBHOOK_SECRET is required'),
  SESSION_SIGNING_SECRET: z.string().min(16, 'SESSION_SIGNING_SECRET must be at least 16 chars'),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:4000'),
});

function parseAgentTokens(rawTokens: string): AgentTokenConfig[] {
  const parts = rawTokens.split(';').map((s) => s.trim()).filter(Boolean);
  return parts.map((part) => {
    const segments = part.split(':');
    if (segments.length < 3) {
      throw new Error(
        `Invalid AGENT_TOKENS entry "${part}". Expected format "name:token:scopes" where scopes are comma-separated.`
      );
    }
    const name = segments[0].trim();
    const token = segments[1].trim();
    const scopesStr = segments.slice(2).join(':'); // in case scopes contain anything
    const rawScopes = scopesStr.split(',').map((s) => s.trim()).filter(Boolean);

    const validScopes: Scope[] = [];
    for (const s of rawScopes) {
      const parsed = ScopeSchema.safeParse(s);
      if (!parsed.success) {
        throw new Error(
          `Invalid scope "${s}" for agent "${name}". Valid scopes: ${ScopeSchema.options.join(', ')}`
        );
      }
      validScopes.push(parsed.data);
    }

    return { name, token, scopes: validScopes };
  });
}

function loadConfig() {
  const parsed = rawEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    console.error(`\n❌ Environment configuration error:\n${issues}\n`);
    throw new Error(`Environment validation failed:\n${issues}`);
  }

  let agentTokens: AgentTokenConfig[] = [];
  try {
    agentTokens = parseAgentTokens(parsed.data.AGENT_TOKENS);
  } catch (err) {
    console.error(`\n❌ AGENT_TOKENS parsing error: ${(err as Error).message}\n`);
    throw err;
  }

  return {
    ...parsed.data,
    parsedAgentTokens: agentTokens,
    // Map of token -> AgentTokenConfig for O(1) lookup
    agentTokenMap: new Map<string, AgentTokenConfig>(
      agentTokens.map((a) => [a.token, a])
    ),
  };
}

export type Config = ReturnType<typeof loadConfig>;
export const config = loadConfig();
