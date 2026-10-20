/** Respostas HTTP padronizadas: CORS liberado para o app web e erros no formato do contrato. */

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function errorResponse(status: number, code: string, message: string, details?: Record<string, unknown>) {
  return json({ error: details ? { code, message, details } : { code, message } }, status);
}

/** Envolve o handler: trata OPTIONS (CORS), método permitido e converte exceções em `{ error }`. */
export function handler(methods: string[], fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (!methods.includes(req.method)) {
      return errorResponse(405, 'METHOD_NOT_ALLOWED', `Use ${methods.join(' ou ')}.`);
    }
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return errorResponse(e.status, e.code, e.message, e.details);
      console.error(e);
      return errorResponse(500, 'INTERNAL', 'Erro interno no servidor. Tente de novo em instantes.');
    }
  };
}

export async function readJson(req: Request, maxBytes = 512 * 1024): Promise<unknown> {
  // QA-08: recusa pelo Content-Length antes de ler o corpo (o tamanho real é conferido de novo depois)
  const declared = Number(req.headers.get('Content-Length') ?? '0');
  if (Number.isFinite(declared) && declared > maxBytes) {
    await req.body?.cancel();
    throw new HttpError(413, 'VALIDATION', 'Requisição grande demais.');
  }
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'VALIDATION', 'Requisição grande demais.');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'VALIDATION', 'Corpo da requisição não é um JSON válido.');
  }
}
