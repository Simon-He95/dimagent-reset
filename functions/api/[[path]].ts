import { handlePetitionRequest } from '../../server/petition'
import type { Env } from '../../server/env'

export const onRequest: PagesFunction<Env> = (context) => {
  return handlePetitionRequest(context.request, context.env, context)
}
