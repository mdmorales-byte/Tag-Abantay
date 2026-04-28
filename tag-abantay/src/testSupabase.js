// Test Supabase connection
// Run this in browser console (F12) or add temporarily to your code

import { supabase } from './services/supabaseClient';

async function testSupabase() {
  console.log('Testing Supabase connection...');
  
  // Test 1: Basic connection
  try {
    const { data, error } = await supabase.from('users').select('count');
    console.log('Test 1 - Users table:', { data, error });
  } catch (e) {
    console.error('Test 1 failed:', e);
  }
  
  // Test 2: Auth ping
  try {
    const { data, error } = await supabase.auth.getSession();
    console.log('Test 2 - Auth session:', { data, error });
  } catch (e) {
    console.error('Test 2 failed:', e);
  }
  
  // Test 3: Try a simple RPC call
  try {
    const { data, error } = await supabase.rpc('version');
    console.log('Test 3 - RPC:', { data, error });
  } catch (e) {
    console.error('Test 3 failed:', e);
  }
}

export { testSupabase };
