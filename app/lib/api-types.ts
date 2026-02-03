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

export type EventStatus = 'upcoming' | 'open' | 'locked' | 'completed';

export type Event = {
  id: string;
  name: string;
  brandId: string;
  eventDate: Date | string;
  status: EventStatus;
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
  participants: Array<{
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

export type CustomPredictionTemplate = {
  id: string;
  name: string;
  description: string | null;
  predictionType: PredictionType;
  createdAt: Date | string;
  updatedAt: Date | string;
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
// Contrarian Mode Types
// ============================================================================

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
  matchPredictions: {
    total: number;
    correct: number;
  };
  customPredictions: {
    total: number;
    correct: number;
  };
  totalScore: number;
  isContrarian: boolean;
  didWinContrarian: boolean | null;
};

export type Leaderboard = UserScore[];

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
