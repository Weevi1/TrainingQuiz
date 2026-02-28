// Supabase client disabled - migrated to Firebase
// This file is kept only to prevent import errors from components not yet migrated

console.warn('⚠️ Supabase client has been disabled - all functionality migrated to Firebase')

export const supabase = {
  // Stub object to prevent import errors
  from: () => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.reject(new Error('Supabase disabled - use Firebase')),
        order: () => Promise.reject(new Error('Supabase disabled - use Firebase'))
      })
    }),
    insert: () => Promise.reject(new Error('Supabase disabled - use Firebase')),
    update: () => Promise.reject(new Error('Supabase disabled - use Firebase')),
    delete: () => Promise.reject(new Error('Supabase disabled - use Firebase'))
  })
}