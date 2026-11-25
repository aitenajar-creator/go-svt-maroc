/* Dedicated Supabase project for the GO SVT Maroc teacher community.
 * Uses only the project's public Publishable key. Never put a service_role
 * or secret key in this browser file.
 */
window.GoSVTTeacherSupabaseConfig = Object.freeze({
  url: window.GoSVTRuntimeConfig ? window.GoSVTRuntimeConfig.teacherSupabaseUrl : 'https://gymofjissiuwpnaxsmcw.supabase.co',
  publishableKey: window.GoSVTRuntimeConfig ? window.GoSVTRuntimeConfig.teacherSupabasePublishableKey : 'sb_publishable_vJxbuhBYjb8wfdaNPzmj2A_wm5Ijksn'
});
