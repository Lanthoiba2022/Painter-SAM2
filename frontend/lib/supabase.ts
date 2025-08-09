import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fcvegigehntahacmzkse.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjdmVnaWdlaG50YWhhY216a3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3NDA1ODYsImV4cCI6MjA3MDMxNjU4Nn0.squUWzylScxy__2HtWVGWb4J3QQhdwtlZWvlwdTmP08'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'x-my-custom-header': 'painter-sam2'
    }
  }
})

// Types for our database schema
export interface UserImage {
  id: string
  user_id: string
  original_filename: string
  file_hash: string
  storage_path: string
  masks_storage_path: string
  upload_timestamp: string
  file_size: number
  image_dimensions: {
    width: number
    height: number
  }
}

// Database table names
export const TABLES = {
  USER_IMAGES: 'user_images'
} as const

// Storage bucket names
export const STORAGE_BUCKETS = {
  USER_IMAGES: 'user-images'
} as const 