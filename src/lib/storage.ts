import type { AppUser, MissionContent } from '../types';

const USERS_KEY = 'mission_users_v2';
const CONTENT_KEY = 'mission_content_v2';
const SESSION_KEY = 'mission_session_v2';

export function loadUsers(): AppUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]') as AppUser[];
  } catch {
    return [];
  }
}

export function saveUsers(users: AppUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function loadContent(): MissionContent | null {
  try {
    const raw = localStorage.getItem(CONTENT_KEY);
    return raw ? (JSON.parse(raw) as MissionContent) : null;
  } catch {
    return null;
  }
}

export function saveContent(content: MissionContent): void {
  localStorage.setItem(CONTENT_KEY, JSON.stringify(content));
}

export function loadSession(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function saveSession(email: string | null): void {
  if (!email) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, email);
}
