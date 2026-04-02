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

export type TimelineStatus = 'done' | 'current' | 'future';

export interface TimelineEvent {
  id: number;
  date: string;
  event: string;
  status: TimelineStatus;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  relation: string;
  message: string;
  date: string;
  replied: boolean;
}

export interface Subscriber {
  email: string;
  date: string;
  relation: string;
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
    week?: number;
    title: string;
    date: string;
    location?: string;
    body: string;
    scripture?: string;
    scriptureRef?: string;
    tags?: string[];
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
    desc?: string;
    album?: string;
    date?: string;
    bg?: string;
    span?: string;
    emoji?: string;
    imageData?: string;
    visibility: 'public' | 'approved';
  }>;
  settings: {
    adminEmails: string[];
    requireApproval: boolean;
    showProgressBar?: boolean;
    showMap?: boolean;
    allowMessages?: boolean;
    allowSubscriptions?: boolean;
    photoGalleryVisible?: boolean;
  };
  scripture?: {
    text: string;
    reference: string;
  };
  timeline?: TimelineEvent[];
  messages?: ContactMessage[];
  subscribers?: Subscriber[];
  stats?: {
    monthsServed: number;
    monthsTotal: number;
    overallProgress: number;
    areaProgress: number;
    weeklyGoalDiscussions: number;
    weeklyGoalTarget: number;
    areasServed: number;
  };
}
