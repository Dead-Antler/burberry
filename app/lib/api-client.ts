/**
 * Frontend API client utilities for making type-safe API calls
 */

import type {
  Brand,
  CreateBrandRequest,
  UpdateBrandRequest,
  Wrestler,
  WrestlerWithHistory,
  CreateWrestlerRequest,
  UpdateWrestlerRequest,
  WrestlerName,
  TagTeam,
  TagTeamWithMembers,
  CreateTagTeamRequest,
  UpdateTagTeamRequest,
  AddTagTeamMemberRequest,
  UpdateTagTeamMemberRequest,
  Championship,
  CreateChampionshipRequest,
  UpdateChampionshipRequest,
  Event,
  EventWithMatches,
  CreateEventRequest,
  UpdateEventRequest,
  Match,
  MatchWithParticipants,
  CreateMatchRequest,
  UpdateMatchRequest,
  CreateMatchParticipantRequest,
  UpdateMatchParticipantRequest,
  MatchPrediction,
  CreateMatchPredictionRequest,
  UpdateMatchPredictionRequest,
  EventCustomPrediction,
  CreateEventCustomPredictionRequest,
  UpdateEventCustomPredictionRequest,
  UserCustomPrediction,
  CreateUserCustomPredictionRequest,
  UpdateUserCustomPredictionRequest,
  UserEventContrarian,
  CreateContrarianRequest,
  ScoreEventResponse,
  UserScore,
  Leaderboard,
} from './api-types';

/**
 * Custom error class for API client errors with status code and request ID
 */
export class ApiClientError extends Error {
  readonly statusCode: number;
  readonly requestId: string | null;

  constructor(message: string, statusCode: number, requestId: string | null = null) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.requestId = requestId;
  }
}

/**
 * Base API client with error handling
 */
class ApiClient {
  private async request<T>(url: string, options?: RequestInit): Promise<T> {
    let response: Response;

    try {
      response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });
    } catch (error) {
      throw new ApiClientError(
        error instanceof Error ? `Network error: ${error.message}` : 'Network error',
        0,
        null
      );
    }

    const requestId = response.headers.get('x-request-id');

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.error || errorMessage;
      } catch {
        // Ignore JSON parse errors for error responses
      }
      throw new ApiClientError(errorMessage, response.status, requestId);
    }

    try {
      return await response.json();
    } catch {
      throw new ApiClientError('Failed to parse response', response.status, requestId);
    }
  }

  // ============================================================================
  // Brands
  // ============================================================================

  async getBrands(): Promise<Brand[]> {
    const response = await this.request<{ data: Brand[] }>('/api/brands');
    return response.data;
  }

  async getBrand(id: string): Promise<Brand> {
    return this.request(`/api/brands/${id}`);
  }

  async createBrand(data: CreateBrandRequest): Promise<Brand> {
    return this.request('/api/brands', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBrand(id: string, data: UpdateBrandRequest): Promise<Brand> {
    return this.request(`/api/brands/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteBrand(id: string): Promise<{ message: string; id: string }> {
    return this.request(`/api/brands/${id}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // Wrestlers
  // ============================================================================

  async getWrestlers(params?: {
    brandId?: string;
    isActive?: boolean;
  }): Promise<Wrestler[]> {
    const query = new URLSearchParams();
    if (params?.brandId) query.set('brandId', params.brandId);
    if (params?.isActive !== undefined) query.set('isActive', String(params.isActive));

    return this.request(`/api/wrestlers?${query}`);
  }

  async getWrestler(id: string, includeHistory = false): Promise<Wrestler | WrestlerWithHistory> {
    const query = includeHistory ? '?includeHistory=true' : '';
    return this.request(`/api/wrestlers/${id}${query}`);
  }

  async createWrestler(data: CreateWrestlerRequest): Promise<Wrestler> {
    return this.request('/api/wrestlers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWrestler(id: string, data: UpdateWrestlerRequest): Promise<Wrestler> {
    return this.request(`/api/wrestlers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteWrestler(id: string): Promise<{ message: string; id: string }> {
    return this.request(`/api/wrestlers/${id}`, {
      method: 'DELETE',
    });
  }

  async getWrestlerNames(id: string): Promise<WrestlerName[]> {
    return this.request(`/api/wrestlers/${id}/names`);
  }

  // ============================================================================
  // Tag Teams
  // ============================================================================

  async getTagTeams(params?: {
    brandId?: string;
    isActive?: boolean;
    includeMembers?: boolean;
  }): Promise<TagTeam[] | TagTeamWithMembers[]> {
    const query = new URLSearchParams();
    if (params?.brandId) query.set('brandId', params.brandId);
    if (params?.isActive !== undefined) query.set('isActive', String(params.isActive));
    if (params?.includeMembers) query.set('includeMembers', 'true');

    return this.request(`/api/tag-teams?${query}`);
  }

  async getTagTeam(id: string, includeMembers = false): Promise<TagTeam | TagTeamWithMembers> {
    const query = includeMembers ? '?includeMembers=true' : '';
    return this.request(`/api/tag-teams/${id}${query}`);
  }

  async createTagTeam(data: CreateTagTeamRequest): Promise<TagTeam> {
    return this.request('/api/tag-teams', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTagTeam(id: string, data: UpdateTagTeamRequest): Promise<TagTeam> {
    return this.request(`/api/tag-teams/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteTagTeam(id: string): Promise<{ message: string; id: string }> {
    return this.request(`/api/tag-teams/${id}`, {
      method: 'DELETE',
    });
  }

  async addTagTeamMember(teamId: string, data: AddTagTeamMemberRequest) {
    return this.request(`/api/tag-teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTagTeamMember(teamId: string, memberId: string, data: UpdateTagTeamMemberRequest) {
    return this.request(`/api/tag-teams/${teamId}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async removeTagTeamMember(teamId: string, memberId: string) {
    return this.request(`/api/tag-teams/${teamId}/members/${memberId}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // Championships
  // ============================================================================

  async getChampionships(params?: {
    brandId?: string;
    isActive?: boolean;
  }): Promise<Championship[]> {
    const query = new URLSearchParams();
    if (params?.brandId) query.set('brandId', params.brandId);
    if (params?.isActive !== undefined) query.set('isActive', String(params.isActive));

    return this.request(`/api/championships?${query}`);
  }

  async getChampionship(id: string): Promise<Championship> {
    return this.request(`/api/championships/${id}`);
  }

  async createChampionship(data: CreateChampionshipRequest): Promise<Championship> {
    return this.request('/api/championships', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateChampionship(id: string, data: UpdateChampionshipRequest): Promise<Championship> {
    return this.request(`/api/championships/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteChampionship(id: string): Promise<{ message: string; id: string }> {
    return this.request(`/api/championships/${id}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // Events
  // ============================================================================

  async getEvents(params?: {
    brandId?: string;
    status?: string;
    fromDate?: Date | string;
    toDate?: Date | string;
    includeMatches?: boolean;
  }): Promise<Event[] | EventWithMatches[]> {
    const query = new URLSearchParams();
    if (params?.brandId) query.set('brandId', params.brandId);
    if (params?.status) query.set('status', params.status);
    if (params?.fromDate) query.set('fromDate', params.fromDate.toString());
    if (params?.toDate) query.set('toDate', params.toDate.toString());
    if (params?.includeMatches) query.set('includeMatches', 'true');

    return this.request(`/api/events?${query}`);
  }

  async getEvent(
    id: string,
    params?: { includeMatches?: boolean; includeCustomPredictions?: boolean }
  ): Promise<Event> {
    const query = new URLSearchParams();
    if (params?.includeMatches) query.set('includeMatches', 'true');
    if (params?.includeCustomPredictions) query.set('includeCustomPredictions', 'true');

    return this.request(`/api/events/${id}?${query}`);
  }

  async createEvent(data: CreateEventRequest): Promise<Event> {
    return this.request('/api/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEvent(id: string, data: UpdateEventRequest): Promise<Event> {
    return this.request(`/api/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteEvent(id: string): Promise<{ message: string; id: string }> {
    return this.request(`/api/events/${id}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // Matches
  // ============================================================================

  async getMatch(
    id: string,
    params?: { includeParticipants?: boolean; includeChampionships?: boolean }
  ): Promise<Match | MatchWithParticipants> {
    const query = new URLSearchParams();
    if (params?.includeParticipants) query.set('includeParticipants', 'true');
    if (params?.includeChampionships) query.set('includeChampionships', 'true');

    return this.request(`/api/matches/${id}?${query}`);
  }

  async createMatch(data: CreateMatchRequest): Promise<Match> {
    return this.request('/api/matches', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMatch(id: string, data: UpdateMatchRequest): Promise<Match> {
    return this.request(`/api/matches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteMatch(id: string): Promise<{ message: string; id: string }> {
    return this.request(`/api/matches/${id}`, {
      method: 'DELETE',
    });
  }

  async addMatchParticipant(matchId: string, data: CreateMatchParticipantRequest) {
    return this.request(`/api/matches/${matchId}/participants`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMatchParticipant(
    matchId: string,
    participantId: string,
    data: UpdateMatchParticipantRequest
  ) {
    return this.request(`/api/matches/${matchId}/participants/${participantId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async removeMatchParticipant(matchId: string, participantId: string) {
    return this.request(`/api/matches/${matchId}/participants/${participantId}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // Match Predictions
  // ============================================================================

  async getMatchPredictions(params?: {
    eventId?: string;
    matchId?: string;
  }): Promise<MatchPrediction[]> {
    const query = new URLSearchParams();
    if (params?.eventId) query.set('eventId', params.eventId);
    if (params?.matchId) query.set('matchId', params.matchId);

    return this.request(`/api/predictions/matches?${query}`);
  }

  async createMatchPrediction(data: CreateMatchPredictionRequest): Promise<MatchPrediction> {
    return this.request('/api/predictions/matches', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMatchPrediction(
    id: string,
    data: UpdateMatchPredictionRequest
  ): Promise<MatchPrediction> {
    return this.request(`/api/predictions/matches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteMatchPrediction(id: string): Promise<{ message: string; id: string }> {
    return this.request(`/api/predictions/matches/${id}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // Custom Predictions
  // ============================================================================

  async getEventCustomPredictions(eventId: string, includeTemplate = false) {
    const query = includeTemplate ? '?includeTemplate=true' : '';
    return this.request(`/api/events/${eventId}/custom-predictions${query}`);
  }

  async createEventCustomPrediction(
    eventId: string,
    data: CreateEventCustomPredictionRequest
  ): Promise<EventCustomPrediction> {
    return this.request(`/api/events/${eventId}/custom-predictions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEventCustomPrediction(
    eventId: string,
    predictionId: string,
    data: UpdateEventCustomPredictionRequest
  ): Promise<EventCustomPrediction> {
    return this.request(`/api/events/${eventId}/custom-predictions/${predictionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteEventCustomPrediction(eventId: string, predictionId: string) {
    return this.request(`/api/events/${eventId}/custom-predictions/${predictionId}`, {
      method: 'DELETE',
    });
  }

  async getUserCustomPredictions(params?: {
    eventId?: string;
    eventCustomPredictionId?: string;
  }): Promise<UserCustomPrediction[]> {
    const query = new URLSearchParams();
    if (params?.eventId) query.set('eventId', params.eventId);
    if (params?.eventCustomPredictionId)
      query.set('eventCustomPredictionId', params.eventCustomPredictionId);

    return this.request(`/api/predictions/custom?${query}`);
  }

  async createUserCustomPrediction(
    data: CreateUserCustomPredictionRequest
  ): Promise<UserCustomPrediction> {
    return this.request('/api/predictions/custom', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUserCustomPrediction(
    id: string,
    data: UpdateUserCustomPredictionRequest
  ): Promise<UserCustomPrediction> {
    return this.request(`/api/predictions/custom/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteUserCustomPrediction(id: string) {
    return this.request(`/api/predictions/custom/${id}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // Contrarian Mode
  // ============================================================================

  async getContrarianStatus(eventId?: string): Promise<UserEventContrarian[]> {
    const query = eventId ? `?eventId=${eventId}` : '';
    return this.request(`/api/predictions/contrarian${query}`);
  }

  async setContrarianMode(data: CreateContrarianRequest): Promise<UserEventContrarian> {
    return this.request('/api/predictions/contrarian', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getEventContrarianStatus(
    eventId: string
  ): Promise<{ isContrarian: boolean; didWinContrarian: boolean | null }> {
    return this.request(`/api/predictions/contrarian/${eventId}`);
  }

  async disableContrarianMode(eventId: string) {
    return this.request(`/api/predictions/contrarian/${eventId}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // Scoring & Results
  // ============================================================================

  async scoreEvent(eventId: string): Promise<ScoreEventResponse> {
    return this.request(`/api/events/${eventId}/score`, {
      method: 'POST',
    });
  }

  async getLeaderboard(eventId: string): Promise<Leaderboard> {
    return this.request(`/api/events/${eventId}/score`);
  }

  async getUserScore(eventId: string, userId: string): Promise<UserScore | null> {
    return this.request(`/api/events/${eventId}/score?userId=${userId}`);
  }
}

/**
 * Singleton API client instance
 */
export const apiClient = new ApiClient();
