export type UserStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface AppUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  salt: string;
  status: UserStatus;
  requestedAt: string;
  decidedAt?: string;
  failedLoginAttempts?: number;
  lockoutUntil?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
}

export interface MissionContent {
  site: {
    title: string;
    subtitle: string;
    missionName: string;
  };
  profile: {
    firstName: string;
    lastName: string;
    bio: string;
    testimony: string;
  };
  updates: Array<{
    id: string;
    title: string;
    date: string;
    body: string;
    visibility: 'public' | 'approved';
  }>;
  map: {
    boundary: Array<[number, number]>;
    currentArea: string;
  };
  photos: Array<{
    id: string;
    title: string;
    url: string;
    visibility: 'public' | 'approved';
  }>;
  settings: {
    adminEmails: string[];
    requireApproval: boolean;
  };
}
