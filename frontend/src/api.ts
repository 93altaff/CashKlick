import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { API_BASE } from './theme';

const TOKEN_KEY = 'cc_session_token';
const USER_KEY = 'cc_user';
const DEVICE_KEY = 'cc_device_id';

export async function setToken(t: string) { await AsyncStorage.setItem(TOKEN_KEY, t); }
export async function getToken() { return AsyncStorage.getItem(TOKEN_KEY); }
export async function clearAuth() {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
}
export async function setCachedUser(u: any) { await AsyncStorage.setItem(USER_KEY, JSON.stringify(u)); }
export async function getCachedUser() {
  const s = await AsyncStorage.getItem(USER_KEY);
  return s ? JSON.parse(s) : null;
}

/**
 * Device identifier used to enforce "one device, one account".
 * - Android: Settings.Secure.ANDROID_ID (per device + per user; cloning apps that
 *   run in isolated user profiles get a different id — limitation of all sandboxed apps).
 * - iOS: identifierForVendor (stable while at least one app from this vendor is installed).
 * - Web / fallback: random uuid persisted in AsyncStorage / localStorage.
 *
 * NOTE: True root/clone detection on Android needs Play Integrity API and a dev build.
 * The Expo Go preview cannot enforce that — this helper is the best-effort baseline.
 */
export async function getDeviceId(): Promise<string> {
  try {
    if (Platform.OS === 'android') {
      const id = Application.getAndroidId();
      if (id) return `and:${id}`;
    } else if (Platform.OS === 'ios') {
      const id = await Application.getIosIdForVendorAsync();
      if (id) return `ios:${id}`;
    }
  } catch {}
  // Web / fallback: persist a uuid.
  const existing = await AsyncStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const fresh = `web:${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_KEY, fresh);
  return fresh;
}

export async function api(path: string, opts: RequestInit = {}) {
  const token = await getToken();
  const headers: any = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error((data && data.detail) || res.statusText);
  return data;
}
