/**
 * Services Index - Re-exports all service modules
 *
 * Usage:
 * import { brandService, wrestlerService } from '@/app/lib/services';
 */

export { brandService } from './brand.service';
export { wrestlerService } from './wrestler.service';
export { tagTeamService } from './tag-team.service';
export { championshipService } from './championship.service';
export { eventService } from './event.service';
export { matchService } from './match.service';
export {
  matchPredictionService,
  customPredictionService,
  contrarianService,
} from './prediction.service';

// Export types
export type { CreateBrandInput, UpdateBrandInput, ListBrandsParams } from './brand.service';
export type { CreateWrestlerInput, UpdateWrestlerInput, ListWrestlersParams } from './wrestler.service';
export type {
  CreateTagTeamInput,
  UpdateTagTeamInput,
  AddMemberInput,
  ListTagTeamsParams,
} from './tag-team.service';
export type {
  CreateChampionshipInput,
  UpdateChampionshipInput,
  ListChampionshipsParams,
} from './championship.service';
export type { CreateEventInput, UpdateEventInput, ListEventsParams } from './event.service';
export type {
  CreateMatchInput,
  UpdateMatchInput,
  ParticipantInput,
  ChampionshipInput,
} from './match.service';
export type {
  CreateMatchPredictionInput,
  UpdateMatchPredictionInput,
  ListMatchPredictionsParams,
  CreateCustomPredictionInput,
  UpdateCustomPredictionInput,
  ListCustomPredictionsParams,
  SetContrarianInput,
} from './prediction.service';
