/**
 * Services Index - Re-exports all service modules
 *
 * Usage:
 * import { brandService, wrestlerService } from '@/app/lib/services';
 */

export { brandService } from './brand.service';
export { wrestlerService } from './wrestler.service';
export { groupService } from './group.service';
export { eventService } from './event.service';
export { matchService } from './match.service';
export {
  matchPredictionService,
  customPredictionService,
  contrarianService,
} from './prediction.service';
export { userService } from './user.service';

// Export types
export type { CreateBrandInput, UpdateBrandInput, ListBrandsParams } from './brand.service';
export type { CreateWrestlerInput, UpdateWrestlerInput, ListWrestlersParams } from './wrestler.service';
export type {
  CreateGroupInput,
  UpdateGroupInput,
  AddMemberInput,
  ListGroupsParams,
} from './group.service';
export type { CreateEventInput, UpdateEventInput, ListEventsParams } from './event.service';
export type {
  CreateMatchInput,
  UpdateMatchInput,
  ParticipantInput,
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
export type { CreateUserInput, UpdateUserInput, ListUsersParams } from './user.service';
