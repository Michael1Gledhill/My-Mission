import type { SiteData } from '../types';

export const DEFAULT_MISSION_BOUNDARY: [number, number][] = [
  [44.7, -115.5], [44.9, -114.2], [45.1, -113.5], [45.5, -113.2], [45.7, -112.8],
  [45.7, -111.5], [45.4, -111.0], [45.2, -110.8], [44.8, -110.7], [44.5, -110.8],
  [44.2, -111.0], [44.1, -111.3], [43.8, -111.5], [43.5, -111.5], [43.2, -111.6],
  [43.0, -112.0], [42.5, -112.2], [42.0, -112.5], [41.8, -112.8], [41.9, -113.5],
  [42.0, -114.0], [42.1, -114.5], [42.5, -115.0], [43.0, -115.5], [43.5, -115.8],
  [44.0, -115.7], [44.3, -115.6], [44.7, -115.5]
];

export const DEFAULT_DATA: SiteData = {
  missionary: {
    firstName: 'Michael',
    lastName: 'Gledhill',
    hometown: 'American Fork, Utah',
    age: 21,
    missionName: 'Idaho Idaho Falls Mission',
    missionPresident: 'President & Sister Harmon',
    startDate: '2024-01-08',
    endDate: '2026-01-08',
    currentCompanion: 'Elder Christensen',
    currentArea: 'Idaho Falls West',
    bio: "Hi! I'm Michael Gledhill — Elder Gledhill out here. I grew up in American Fork, Utah as the oldest of five kids in a family that loves the gospel, hiking, and football.",
    testimony: 'I know that God lives, that Jesus Christ is our Savior, and that this work matters.',
    hobbies: ['Basketball', 'Guitar', 'Hiking', 'Reading', 'BYU Football', 'Writing', 'Music', 'Cooking'],
    collegePlans: 'BYU-Idaho — Communications'
  },
  stats: {
    monthsServed: 14,
    monthsTotal: 24,
    weeklyUpdates: 47,
    areasServed: 3,
    overallProgress: 58,
    areaProgress: 50,
    weeklyGoalDiscussions: 8,
    weeklyGoalTarget: 12,
    subscribers: 124
  },
  location: {
    city: 'Idaho Falls',
    state: 'Idaho',
    lat: 43.4917,
    lng: -112.0339,
    areaDescription: 'Idaho Falls West Area'
  },
  scripture: {
    text: 'And the Spirit shall be given unto you by the prayer of faith.',
    reference: 'Doctrine & Covenants 42:14'
  },
  mapBoundaries: {
    missionBoundary: DEFAULT_MISSION_BOUNDARY,
    areas: [
      { id: 'rexburg', name: 'Rexburg', status: 'completed', startDate: 'March 2024', endDate: 'September 2024', lat: 43.8235, lng: -111.7899, boundary: [] },
      { id: 'pocatello', name: 'Pocatello', status: 'completed', startDate: 'September 2024', endDate: 'January 2025', lat: 42.8713, lng: -112.4455, boundary: [] },
      { id: 'idahofalls', name: 'Idaho Falls West', status: 'current', startDate: 'January 2025', endDate: null, lat: 43.4917, lng: -112.0339, boundary: [] }
    ],
    cities: [
      { name: 'Twin Falls', lat: 42.5629, lng: -114.4609, type: 'city' },
      { name: 'Blackfoot', lat: 43.1908, lng: -112.3449, type: 'city' },
      { name: 'American Falls', lat: 42.7877, lng: -112.8607, type: 'city' },
      { name: 'Rigby', lat: 43.6724, lng: -111.9135, type: 'city' },
      { name: 'St Anthony', lat: 43.969, lng: -111.6824, type: 'city' },
      { name: 'Soda Springs', lat: 42.6541, lng: -111.6046, type: 'city' },
      { name: 'Montpelier', lat: 42.3213, lng: -111.2988, type: 'city' },
      { name: 'Preston', lat: 42.0963, lng: -111.8766, type: 'city' },
      { name: 'Salmon', lat: 45.1763, lng: -113.8958, type: 'city' },
      { name: 'Ashton', lat: 44.0716, lng: -111.4488, type: 'city' },
      { name: 'Burley', lat: 42.536, lng: -113.7918, type: 'city' }
    ]
  },
  timeline: [
    { id: 1, date: 'January 2024', event: 'Entered the MTC in Provo, Utah', status: 'done' },
    { id: 2, date: 'March 2024', event: 'Arrived in Idaho — First area: Rexburg', status: 'done' },
    { id: 3, date: 'September 2024', event: 'Transferred to Pocatello', status: 'done' },
    { id: 4, date: 'January 2025', event: 'Transferred to Idaho Falls West', status: 'current' },
    { id: 5, date: 'July 2025', event: '18-month mark 🎉', status: 'future' },
    { id: 6, date: 'January 2026', event: 'Return Home — Mission Complete!', status: 'future' }
  ],
  posts: [
    {
      id: 1742784000000,
      week: 47,
      date: 'March 24, 2025',
      title: 'A Family That Changed Everything',
      location: 'Idaho Falls, ID – West Area',
      body: 'Dear family and friends,\n\nThis has been one of the most spiritual weeks of my mission.\n\nLove, Elder Gledhill',
      scripture: 'And the Spirit shall be given unto you by the prayer of faith.',
      scriptureRef: 'D&C 42:14',
      tags: ['Teaching', 'Investigators', 'Ward Mission']
    }
  ],
  photos: [
    {
      id: 1,
      emoji: '🌄',
      title: 'Snake River at Sunset',
      desc: 'The Snake River right at golden hour after a long day of teaching.',
      album: 'March 2025',
      date: 'March 2025',
      bg: 'linear-gradient(135deg,#b8d4f0,#7aaad8)',
      span: 'r2'
    }
  ],
  messages: [
    {
      id: 1,
      name: 'Grandma Ruth',
      email: 'grandmaruth@gmail.com',
      relation: 'Family member',
      message: 'So proud of you Elder! We pray for you every morning.',
      date: 'March 25, 2025',
      replied: false
    }
  ],
  subscribers: [
    { email: 'grandmaruth@gmail.com', date: 'March 2024', relation: 'Family' },
    { email: 'tylerh1994@yahoo.com', date: 'January 2025', relation: 'Friend' },
    { email: 'sisterjohnson@gmail.com', date: 'February 2025', relation: 'Ward' }
  ]
};
