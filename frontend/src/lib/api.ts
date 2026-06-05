import axios from 'axios'

import { supabase } from './supabase'

/**
 * Axios instance for the ContractScan backend.
 *
 * Every request automatically carries the current Supabase session JWT as a
 * Bearer token. The backend extracts `user_id` from this token — it is the only
 * trusted source of identity, so the client never sends user_id itself.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }

  return config
})
