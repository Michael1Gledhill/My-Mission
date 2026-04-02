import type { SiteData, StoredSiteData } from '../types';

const ADMIN_DATA_KEY = 'mission_admin_data';
const GITHUB_KEY = 'mission_gh';
const PASSWORD_KEY = 'mission_pw';

export const STORAGE_KEYS = {
  adminData: ADMIN_DATA_KEY,
  ghConfig: GITHUB_KEY,
  password: PASSWORD_KEY,
  setupGuide: 'guide_state'
};

export function loadAdminData(): StoredSiteData | null {
  try {
    const raw = localStorage.getItem(ADMIN_DATA_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSiteData;
    if (typeof parsed?._ts !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveAdminData(data: SiteData): StoredSiteData {
  const withTs: StoredSiteData = { ...data, _ts: Date.now() };
  localStorage.setItem(ADMIN_DATA_KEY, JSON.stringify(withTs));
  return withTs;
}

export function loadPassword(): string {
  return localStorage.getItem(PASSWORD_KEY) || 'mission2024';
}

export function savePassword(password: string): void {
  localStorage.setItem(PASSWORD_KEY, password);
}
