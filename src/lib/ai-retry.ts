import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function createMessageWithRetry(
  params: Anthropic.MessageCreateParamsNonStreaming,
  maxAttempts = 3,
): Promise<Anthropic.Message> {
  // 429/529 = rate limit → longer backoff; 5xx = server error → short backoff
  const delays = (status: number | undefined) =>
    status === 429 || status === 529 ? [8000, 20000] : [1500, 3000]
  let lastError: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await client.messages.create(params)
    } catch (err: unknown) {
      lastError = err
      const status = (err as { status?: number }).status
      if (status === 400 || status === 401) throw err
      if (attempt < maxAttempts - 1) {
        const d = delays(status)
        await new Promise((r) => setTimeout(r, d[attempt] ?? d[d.length - 1]))
      }
    }
  }

  throw lastError
}