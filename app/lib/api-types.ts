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

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
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

// ============================================================================
// Tag Team Types
// ============================================================================

export type TagTeam = {
  id: string;
  name: string;
  brandId: string;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type TagTeamMember = {
  id: string;
  tagTeamId: string;
  wrestlerId: string;
  joinedAt: Date | string;
  leftAt: Date | string | null;
  createdAt: Date | string;
};

export type TagTeamMemberWithWrestler = TagTeamMember & {
  wrestlerName: string;
};

export type TagTeamWithMembers = TagTeam & {
  members: TagTeamMemberWithWrestler[];
};

export type CreateTagTeamRequest = {
  name: string;
  brandId: string;
  isActive?: boolean;
  memberIds?: string[];
};

export type UpdateTagTeamRequest = {
  name?: string;
  brandId?: string;
  isActive?: boolean;
};

export type AddTagTeamMemberRequest = {
  wrestlerId: string;
  joinedAt?: Date | string;
};

export type UpdateTagTeamMemberRequest = {
  leftAt?: Date | string | null;
};

// ============================================================================
// Championship Types
// ============================================================================

export type Championship = {
  id: string;
  name: string;
  brandId: string;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type CreateChampionshipRequest = {
  name: string;
  brandId: string;
  isActive?: boolean;
};

export type UpdateChampionshipRequest = {
  name?: string;
  brandId?: string;
  isActive?: boolean;
};

// ============================================================================
// Event Types
// ============================================================================

export type EventStatus = 'open' | 'locked' | 'completed';

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
  participantType: 'wrestler' | 'tag_team';
  participantId: string;
  entryOrder: number | null;
  createdAt: Date | string;
};

export type MatchParticipantWithData = MatchParticipant & {
  participant: Wrestler | TagTeam;
};

export type MatchWithParticipants = Match & {
  participants: MatchParticipantWithData[];
};

export type MatchCombatantChampionship = {
  id: string;
  matchId: string;
  championshipId: string;
  participantType: 'wrestler' | 'tag_team';
  participantId: string;
  createdAt: Date | string;
};

export type MatchCombatantChampionshipWithData = MatchCombatantChampionship & {
  championship: Championship;
};

export type CreateMatchRequest = {
  eventId: string;
  matchType: string;
  matchOrder: number;
  participants: Array<{
    side: number | null;
    participantType: 'wrestler' | 'tag_team';
    participantId: string;
    entryOrder?: number | null;
  }>;
  championships?: Array<{
    championshipId: string;
    participantType: 'wrestler' | 'tag_team';
    participantId: string;
  }>;
};

export type UpdateMatchRequest = {
  matchType?: string;
  matchOrder?: number;
  outcome?: MatchOutcome | null;
  winningSide?: number | null;
  winnerParticipantId?: string | null;
};

export type CreateMatchParticipantRequest = {
  side: number | null;
  participantType: 'wrestler' | 'tag_team';
  participantId: string;
  entryOrder?: number | null;
};

export type UpdateMatchParticipantRequest = {
  side?: number | null;
  entryOrder?: number | null;
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

export type TagTeamQueryParams = {
  brandId?: string;
  isActive?: boolean;
  includeMembers?: boolean;
};

export type ChampionshipQueryParams = {
  brandId?: string;
  isActive?: boolean;
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
  includeChampionships?: boolean;
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
