import { handlePetitionRequest } from '../server/petition'
import type { Env } from '../server/env'

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handlePetitionRequest(request, env, ctx)
  },
} satisfies ExportedHandler<Env>
