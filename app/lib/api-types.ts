/**
 * TypeScript type definitions for API requests and responses
 * These types are used by both the API routes and frontend clients
 */

// ============================================================================
// Common Types
// ============================================================================

export type ApiResponse<T> = {
  data?: T;
  error?: string;
};

export type PaginationInfo = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: PaginationInfo;
};

// ============================================================================
// User Types
// ============================================================================

export type User = {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
  isAdmin: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  // Note: password field intentionally excluded for security
};

export type CreateUserRequest = {
  email: string;
  password: string;
  name?: string | null;
  isAdmin?: boolean;
};

export type UpdateUserRequest = {
  email?: string;
  password?: string;
  name?: string | null;
  isAdmin?: boolean;
};

// ============================================================================
// Profile Types
// ============================================================================

export type ColorTheme = 'blue' | 'green' | 'neutral' | 'orange' | 'red' | 'rose' | 'violet' | 'yellow';

export type ProfileData = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  theme: string | null;
};

export type UpdateProfileRequest = {
  name?: string | null;
  email?: string;
  theme?: ColorTheme;
};

export type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

// ============================================================================
// Brand Types
// ============================================================================

export type Brand = {
  id: string;
  name: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type CreateBrandRequest = {
  name: string;
};

export type UpdateBrandRequest = {
  name?: string;
};

// ============================================================================
// Wrestler Types
// ============================================================================

export type Wrestler = {
  id: string;
  currentName: string;
  brandId: string;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type WrestlerWithHistory = Wrestler & {
  nameHistory: WrestlerName[];
};

export type WrestlerName = {
  id: string;
  wrestlerId: string;
  name: string;
  validFrom: Date | string;
  validTo: Date | string | null;
  createdAt: Date | string;
};

export type CreateWrestlerRequest = {
  currentName: string;
  brandId: string;
  isActive?: boolean;
};

export type UpdateWrestlerRequest = {
  currentName?: string;
  brandId?: string;
  isActive?: boolean;
};

export type WrestlerGroupInfo = {
  id: string;
  name: string;
};

export type WrestlerWithGroups = Wrestler & {
  groups: WrestlerGroupInfo[];
};

// ============================================================================
// Group Types
// ============================================================================

export type Group = {
  id: string;
  name: string;
  brandId: string;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type GroupMember = {
  id: string;
  groupId: string;
  wrestlerId: string;
  joinedAt: Date | string;
  leftAt: Date | string | null;
  createdAt: Date | string;
};

export type GroupMemberWithWrestler = GroupMember & {
  wrestlerName: string;
};

export type GroupWithMembers = Group & {
  members: GroupMemberWithWrestler[];
};

export type CreateGroupRequest = {
  name: string;
  brandId: string;
  isActive?: boolean;
  memberIds?: string[];
};

export type UpdateGroupRequest = {
  name?: string;
  brandId?: string;
  isActive?: boolean;
};

export type AddGroupMemberRequest = {
  wrestlerId: string;
  joinedAt?: Date | string;
};

export type UpdateGroupMemberRequest = {
  leftAt?: Date | string | null;
};

// ============================================================================
// Event Types
// ============================================================================

export type EventStatus = 'pending' | 'open' | 'locked' | 'completed';
export type EventJoinMode = 'normal' | 'contrarian';

export type Event = {
  id: string;
  name: string;
  brandId: string;
  eventDate: Date | string;
  status: EventStatus;
  hidePredictors: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type EventWithMatches = Event & {
  matches: MatchWithParticipants[];
};

export type EventWithCustomPredictions = Event & {
  customPredictions: EventCustomPrediction[];
};

export type CreateEventRequest = {
  name: string;
  brandId: string;
  eventDate: Date | string;
  status?: EventStatus;
};

export type UpdateEventRequest = {
  name?: string;
  brandId?: string;
  eventDate?: Date | string;
  status?: EventStatus;
};

// ============================================================================
// Match Types
// ============================================================================

export type MatchOutcome = 'winner' | 'draw' | 'no_contest';

export type Match = {
  id: string;
  eventId: string;
  matchType: string;
  matchOrder: number;
  unknownParticipants: boolean;
  isLocked: boolean;
  predictionDeadline: Date | string | null;
  outcome: MatchOutcome | null;
  winningSide: number | null;
  winnerParticipantId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type MatchParticipant = {
  id: string;
  matchId: string;
  side: number | null;
  participantType: 'wrestler' | 'group';
  participantId: string;
  entryOrder: number | null;
  isChampion: boolean;
  createdAt: Date | string;
};

export type MatchParticipantWithData = MatchParticipant & {
  participant: Wrestler | Group;
  groups?: WrestlerGroupInfo[]; // Only populated for wrestler participants
};

export type MatchWithParticipants = Match & {
  participants: MatchParticipantWithData[];
};

export type CreateMatchRequest = {
  eventId: string;
  matchType: string;
  matchOrder: number;
  unknownParticipants?: boolean;
  isLocked?: boolean;
  participants?: Array<{
    side: number | null;
    participantType: 'wrestler' | 'group';
    participantId: string;
    entryOrder?: number | null;
    isChampion?: boolean;
  }>;
};

export type UpdateMatchRequest = {
  matchType?: string;
  matchOrder?: number;
  unknownParticipants?: boolean;
  isLocked?: boolean;
  outcome?: MatchOutcome | null;
  winningSide?: number | null;
  winnerParticipantId?: string | null;
};

export type CreateMatchParticipantRequest = {
  side: number | null;
  participantType: 'wrestler' | 'group';
  participantId: string;
  entryOrder?: number | null;
  isChampion?: boolean;
};

export type UpdateMatchParticipantRequest = {
  side?: number | null;
  entryOrder?: number | null;
  isChampion?: boolean;
};

// ============================================================================
// Match Prediction Types
// ============================================================================

export type MatchPrediction = {
  id: string;
  userId: string;
  matchId: string;
  predictedSide: number | null;
  predictedParticipantId: string | null;
  isCorrect: boolean | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type CreateMatchPredictionRequest = {
  matchId: string;
  predictedSide?: number | null;
  predictedParticipantId?: string | null;
};

export type UpdateMatchPredictionRequest = {
  predictedSide?: number | null;
  predictedParticipantId?: string | null;
};

// ============================================================================
// Custom Prediction Types
// ============================================================================

export type PredictionType = 'time' | 'count' | 'wrestler' | 'boolean' | 'text';

export type ScoringMode = 'exact' | 'closest_under';

export type CustomPredictionTemplate = {
  id: string;
  name: string;
  description: string | null;
  predictionType: PredictionType;
  scoringMode: ScoringMode;
  cooldownDays: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type CreateCustomPredictionTemplateRequest = {
  name: string;
  description?: string | null;
  predictionType: PredictionType;
  scoringMode?: ScoringMode;
  cooldownDays?: number | null;
};

export type UpdateCustomPredictionTemplateRequest = {
  name?: string;
  description?: string | null;
  predictionType?: PredictionType;
  scoringMode?: ScoringMode;
  cooldownDays?: number | null;
};

export type PredictionGroup = {
  id: string;
  name: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type PredictionGroupMember = {
  id: string;
  groupId: string;
  templateId: string;
  createdAt: Date | string;
};

export type PredictionGroupWithMembers = PredictionGroup & {
  templates: CustomPredictionTemplate[];
};

export type CreatePredictionGroupRequest = {
  name: string;
};

export type UpdatePredictionGroupRequest = {
  name?: string;
};

export type EventCustomPrediction = {
  id: string;
  eventId: string;
  templateId: string;
  question: string;
  answerTime: Date | string | null;
  answerCount: number | null;
  answerWrestlerId: string | null;
  answerBoolean: boolean | null;
  answerText: string | null;
  isScored: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type EventCustomPredictionWithTemplate = {
  eventCustomPrediction: EventCustomPrediction;
  template: CustomPredictionTemplate;
};

export type UserCustomPrediction = {
  id: string;
  userId: string;
  eventCustomPredictionId: string;
  predictionTime: Date | string | null;
  predictionCount: number | null;
  predictionWrestlerId: string | null;
  predictionBoolean: boolean | null;
  predictionText: string | null;
  isCorrect: boolean | null;
  pointsEarned: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type CreateEventCustomPredictionRequest = {
  templateId: string;
  question: string;
};

export type UpdateEventCustomPredictionRequest = {
  question?: string;
  answerTime?: Date | string | null;
  answerCount?: number | null;
  answerWrestlerId?: string | null;
  answerBoolean?: boolean | null;
  answerText?: string | null;
  isScored?: boolean;
};

export type CreateUserCustomPredictionRequest = {
  eventCustomPredictionId: string;
  predictionTime?: Date | string | null;
  predictionCount?: number | null;
  predictionWrestlerId?: string | null;
  predictionBoolean?: boolean | null;
  predictionText?: string | null;
};

export type UpdateUserCustomPredictionRequest = {
  predictionTime?: Date | string | null;
  predictionCount?: number | null;
  predictionWrestlerId?: string | null;
  predictionBoolean?: boolean | null;
  predictionText?: string | null;
};

// ============================================================================
// Contrarian Mode Types (Legacy - use EventJoin instead)
// ============================================================================

// Kept for backward compatibility with existing API endpoints
export type UserEventContrarian = {
  id: string;
  userId: string;
  eventId: string;
  isContrarian: boolean;
  didWinContrarian: boolean | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type CreateContrarianRequest = {
  eventId: string;
  isContrarian: boolean;
};

// ============================================================================
// Scoring Types
// ============================================================================

export type ScoreEventResponse = {
  message: string;
  matchPredictionsScored: number;
  customPredictionsScored: number;
  contrarianScored: number;
};

export type UserScore = {
  userId: string;
  user?: {
    name: string | null;
    email: string;
    image?: string | null;
  };
  matchPredictions: {
    total: number;
    correct: number;
  };
  customPredictions: {
    total: number;
    correct: number;
    points: number;
  };
  totalScore: number;
  isContrarian: boolean;
  didWinContrarian: boolean | null;
};

export type Leaderboard = UserScore[];

export type OverallUserScore = {
  userId: string;
  user?: {
    name: string | null;
    email: string;
    image?: string | null;
  };
  totalPoints: number;
  eventsParticipated: number;
  matchPredictions: {
    total: number;
    correct: number;
  };
  customPredictions: {
    total: number;
    correct: number;
    points: number;
  };
  contrarianWins: number;
  firstPlaceFinishes: number;
};

export type OverallLeaderboard = OverallUserScore[];

// ============================================================================
// Query Parameter Types
// ============================================================================

export type WrestlerQueryParams = {
  brandId?: string;
  isActive?: boolean;
  includeHistory?: boolean;
};

export type GroupQueryParams = {
  brandId?: string;
  isActive?: boolean;
  includeMembers?: boolean;
};

export type EventQueryParams = {
  brandId?: string;
  status?: EventStatus;
  fromDate?: Date | string;
  toDate?: Date | string;
  includeMatches?: boolean;
  includeCustomPredictions?: boolean;
};

export type MatchQueryParams = {
  includeParticipants?: boolean;
};

export type MatchPredictionQueryParams = {
  eventId?: string;
  matchId?: string;
};

export type CustomPredictionQueryParams = {
  eventId?: string;
  eventCustomPredictionId?: string;
  includeTemplate?: boolean;
};

export type ContrarianQueryParams = {
  eventId?: string;
};

export type ScoreQueryParams = {
  userId?: string;
};

// ============================================================================
// Event Join Types
// ============================================================================

export type EventJoin = {
  id: string;
  userId: string;
  eventId: string;
  mode: EventJoinMode;
  didWinContrarian: boolean | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type EventJoinWithUser = EventJoin & {
  user: User;
};

export type JoinEventRequest = {
  mode: EventJoinMode;
};

// ============================================================================
// Prediction Stats Types (for real-time updates)
// ============================================================================

export type PredictionDistribution = {
  side: number | null;
  participantId: string | null;
  percentage: number;
  count: number;
  predictors: string[] | null; // null if hidePredictors is true
};

export type MatchPredictionStats = {
  matchId: string;
  totalPredictions: number;
  distribution: PredictionDistribution[];
};

export type CustomPredictionStats = {
  eventCustomPredictionId: string;
  totalPredictions: number;
  distribution: Array<{
    value: string | number | boolean;
    count: number;
    percentage: number;
    predictors: string[] | null;
  }>;
};

export type EventPredictionStats = {
  eventId: string;
  matches: MatchPredictionStats[];
  customPredictions: CustomPredictionStats[];
};

// ============================================================================
// Wrestler Prediction Cooldown Types
// ============================================================================

export type WrestlerPredictionCooldown = {
  id: string;
  userId: string;
  wrestlerId: string;
  brandId: string;
  eventCustomPredictionId: string;
  lastPredictedAt: Date | string;
  createdAt: Date | string;
};

export type WrestlerCooldownStatus = {
  wrestlerId: string;
  isOnCooldown: boolean;
  availableAt: Date | string | null;
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the display name for a match participant.
 * Wrestlers have `currentName`, groups have `name`.
 */
export function getParticipantDisplayName(participant: Wrestler | Group): string {
  if ('currentName' in participant) {
    return participant.currentName;
  }
  return participant.name;
}
