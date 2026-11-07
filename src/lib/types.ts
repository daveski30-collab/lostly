// The shapes of data Lostly works with. Start here if you are new to the code.

/** Days of the week, 0 = Sunday ... 6 = Saturday (same as JavaScript's Date.getDay()). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Something you want to remember to bring. */
export type Item = {
  id: string;
  label: string;
  emoji: string;
  /** Only show this item on certain days (e.g. gym bag on Tue/Thu). Empty or missing = every day. */
  days?: Weekday[];
};

/**
 * The "smart" part. These rules decide whether leaving a place is worth a nudge,
 * so Lostly stays helpful instead of annoying.
 */
export type NudgeRules = {
  /** Master switch for this place. */
  enabled: boolean;
  /** Only nudge if you stayed at least this long. Stops nudges when you just drive past. */
  minDwellMinutes: number;
  /** After a nudge, stay quiet for this long, even if you leave again. */
  cooldownMinutes: number;
  /** Only nudge on these days. Empty = every day. */
  activeDays: Weekday[];
  /** Only nudge between these hours (24h clock). null = any time. Overnight windows like 22 to 6 work too. */
  activeHours: { start: number; end: number } | null;
  /** If you already checked off everything here within this many minutes, skip the nudge. */
  skipIfCheckedWithinMinutes: number;
};

/** A saved place like Home, School, or the Gym. */
export type Place = {
  id: string;
  name: string;
  emoji: string;
  /** Where the place is. null = not set yet (Lostly cannot watch it until you set it). */
  location: { latitude: number; longitude: number } | null;
  /** How far (meters) you go before Lostly counts it as "you left". Phones need at least ~100m to be reliable. */
  radiusMeters: number;
  items: Item[];
  rules: NudgeRules;
};

/** What Lostly remembers about your visits, used by the rules. */
export type VisitState = {
  /** When you arrived at each place (ms since 1970). Missing = unknown. */
  enteredAt: Record<string, number | undefined>;
  /** When we last nudged you for each place. */
  lastNudgedAt: Record<string, number | undefined>;
  /** When you last finished the checklist for each place. */
  lastCheckedAt: Record<string, number | undefined>;
};

/** One finished checklist, kept so Lostly can learn what you forget most. */
export type CheckRecord = {
  placeId: string;
  at: number;
  /** Item ids you said you did NOT have. */
  missing: string[];
};

export type NudgeDecision = { nudge: true } | { nudge: false; reason: string };
