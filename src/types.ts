export interface MissionaryProfile {
  firstName: string;
  lastName: string;
  hometown: string;
  age: number;
  missionName: string;
  missionPresident: string;
  startDate: string;
  endDate: string;
  currentCompanion: string;
  currentArea: string;
  bio: string;
  testimony: string;
  hobbies: string[];
  collegePlans: string;
}

export interface MissionStats {
  monthsServed: number;
  monthsTotal: number;
  weeklyUpdates: number;
  areasServed: number;
  overallProgress: number;
  areaProgress: number;
  weeklyGoalDiscussions: number;
  weeklyGoalTarget: number;
  subscribers: number;
}

export interface CurrentLocation {
  city: string;
  state: string;
  lat: number;
  lng: number;
  areaDescription: string;
}

export interface Scripture {
  text: string;
  reference: string;
}

export type AreaStatus = 'completed' | 'current' | 'future';

export interface MissionArea {
  id: string;
  name: string;
  status: AreaStatus;
  startDate: string | null;
  endDate: string | null;
  lat: number;
  lng: number;
  boundary: [number, number][];
}

export interface MissionCity {
  name: string;
  lat: number;
  lng: number;
  type: 'city';
}

export interface MapBoundaries {
  missionBoundary: [number, number][];
  areas: MissionArea[];
  cities: MissionCity[];
}

export type TimelineStatus = 'done' | 'current' | 'future';

export interface TimelineEvent {
  id: number;
  date: string;
  event: string;
  status: TimelineStatus;
}

export interface Post {
  id: number;
  week: number;
  date: string;
  title: string;
  location: string;
  body: string;
  scripture: string;
  scriptureRef: string;
  tags: string[];
}

export interface Photo {
  id: number;
  emoji: string;
  title: string;
  desc: string;
  album: string;
  date: string;
  bg: string;
  span: string;
  imageData?: string;
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

export interface SiteData {
  missionary: MissionaryProfile;
  stats: MissionStats;
  location: CurrentLocation;
  scripture: Scripture;
  mapBoundaries: MapBoundaries;
  timeline: TimelineEvent[];
  posts: Post[];
  photos: Photo[];
  messages: ContactMessage[];
  subscribers: Subscriber[];
}

export interface GitHubConfig {
  user: string;
  repo: string;
  branch: string;
  token: string;
}

export interface StoredSiteData extends SiteData {
  _ts: number;
}
