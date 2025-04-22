import { createClient } from "@supabase/supabase-js"

// Create a single supabase client for the browser
let browserClient: ReturnType<typeof createClient> | null = null
const serverClient: ReturnType<typeof createClient> | null = null

// Browser client with proper singleton pattern
export const getSupabaseBrowserClient = () => {
  if (browserClient) return browserClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables for browser client")
    // Return a dummy client or null
    return createMockClient()
  }

  browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })

  return browserClient
}

// Server-side client with service role for admin operations
export const createServerClient = () => {
  // We're in a server context (Server Component or Server Action)
  if (typeof window === "undefined") {
    // Create a new server client each time to avoid issues with concurrent requests
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables for server client")
      console.error("SUPABASE_URL:", supabaseUrl)
      console.error("SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceKey ? "exists" : "missing")

      // Fallback to anon key if service role key is missing
      const fallbackKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (supabaseUrl && fallbackKey) {
        console.warn("Using anon key as fallback - this may cause RLS policy issues")
        return createClient(supabaseUrl, fallbackKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        })
      }

      // Return a mock client that won't crash the app but logs the issue
      return createMockClient()
    }

    console.log("Creating server client with service role key")
    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  // If we're in the browser, use the browser client
  return getSupabaseBrowserClient()
}

// Create a mock client for error cases
function createMockClient() {
  console.error("Using mock Supabase client - database operations will fail")
  return {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: [], error: null }),
        eq: () => Promise.resolve({ data: [], error: null }),
        in: () => Promise.resolve({ data: [], error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      }),
      insert: () => Promise.resolve({ data: [], error: { message: "Mock client cannot insert data" } }),
      update: () => Promise.resolve({ data: null, error: { message: "Mock client cannot update data" } }),
      delete: () => Promise.resolve({ data: null, error: { message: "Mock client cannot delete data" } }),
    }),
  } as any
}
