import type { AppUser, AuditLogEntry, MissionContent } from '../types';

const USERS_KEY = 'mission_users_v2';
const CONTENT_KEY = 'mission_content_v2';
const DATA_KEY = 'mission_data_v2';
const SESSION_KEY = 'mission_session_v2';
const AUDIT_LOG_KEY = 'mission_audit_log_v1';
const BOOTSTRAP_ADMIN_KEY = 'mission_bootstrap_admin_v1';

// ===== Users =====
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

// ===== Content (deprecated, use Data instead) =====
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

// ===== Data (new structure) =====
export function loadData(): MissionContent | null {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    return raw ? (JSON.parse(raw) as MissionContent) : null;
  } catch {
    return null;
  }
}

export function saveData(data: MissionContent): void {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

// ===== Session =====
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

// ===== Audit Log =====
export function loadAuditLog(): AuditLogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(AUDIT_LOG_KEY) ?? '[]') as AuditLogEntry[];
  } catch {
    return [];
  }
}

export function saveAuditLog(entries: AuditLogEntry[]): void {
  localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(entries));
}

// ===== Bootstrap Admin =====
export function loadBootstrapAdmin(): { email: string; password: string } | null {
  try {
    const raw = localStorage.getItem(BOOTSTRAP_ADMIN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveBootstrapAdmin(creds: { email: string; password: string }): void {
  localStorage.setItem(BOOTSTRAP_ADMIN_KEY, JSON.stringify(creds));
}

export function clearBootstrapAdmin(): void {
  localStorage.removeItem(BOOTSTRAP_ADMIN_KEY);
}
