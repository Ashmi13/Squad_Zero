import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://iatjbhvtcvnsbitpbfim.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhdGpiaHZ0Y3Zuc2JpdHBiZmltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MTM0MjksImV4cCI6MjA5MDI4OTQyOX0.-zJPUHIHfVWhN3YLZpxaZW5H9-RbtYE2LdHKK0QWGkk';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL and Anon Key are required! Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
