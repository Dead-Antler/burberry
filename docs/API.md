# RESTful API Documentation

This document describes all available REST API endpoints for the wrestling prediction system.

## Authentication

All API endpoints require authentication via session cookies (managed by Better Auth). Users must be logged in to access any API endpoint.

## Authorization & Permissions

The system implements role-based access control with two user roles:

### User Roles

**Normal Users** can:
- ✅ Make and manage their own predictions (match predictions, custom predictions, contrarian mode)
- ✅ View all data (brands, wrestlers, groups, events, matches, leaderboards)

**Admins** can:
- ✅ Everything normal users can do, PLUS:
- ✅ Create, update, and delete all entities (brands, wrestlers, groups, events, matches)
- ✅ Enter match results and custom prediction answers
- ✅ Change event status (open → locked → completed)
- ✅ Trigger event scoring

### Permission Errors

Attempting to access admin-only endpoints as a normal user returns:

```json
{
  "error": "Forbidden - Admin access required"
}
```

**Status Code:** `403 Forbidden`

**Note:** Endpoints marked with `[ADMIN ONLY]` in this documentation require admin privileges.

## Rate Limiting

Authentication endpoints are rate limited by Better Auth:
- Sign-in: 5 attempts per 15 minutes per IP
- Sign-up: 5 attempts per hour per IP
- Other auth endpoints: 100 requests per minute per IP

## Common Response Formats

### Success Response
```json
{
  "data": { ... }
}
```

### Error Response
```json
{
  "error": "Error message"
}
```

---

## Brands

### List All Brands
```
GET /api/brands
```

**Response:**
```json
[
  {
    "id": "brand_...",
    "name": "WWE",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Get Brand
```
GET /api/brands/:id
```

### Create Brand `[ADMIN ONLY]`
```
POST /api/brands
Content-Type: application/json

{
  "name": "WWE"
}
```

### Update Brand `[ADMIN ONLY]`
```
PATCH /api/brands/:id
Content-Type: application/json

{
  "name": "WWE Updated"
}
```

### Delete Brand `[ADMIN ONLY]`
```
DELETE /api/brands/:id
```

---

## Wrestlers

### List All Wrestlers
```
GET /api/wrestlers?brandId=xxx&isActive=true
```

**Query Parameters:**
- `brandId` (optional): Filter by brand
- `isActive` (optional): Filter by active status (`true`/`false`)

### Get Wrestler
```
GET /api/wrestlers/:id?includeHistory=true
```

**Query Parameters:**
- `includeHistory` (optional): Include name history

### Create Wrestler `[ADMIN ONLY]`
```
POST /api/wrestlers
Content-Type: application/json

{
  "currentName": "Roman Reigns",
  "brandId": "brand_...",
  "isActive": true
}
```

**Note:** Automatically creates initial name history entry.

### Update Wrestler `[ADMIN ONLY]`
```
PATCH /api/wrestlers/:id
Content-Type: application/json

{
  "currentName": "The Tribal Chief",
  "brandId": "brand_...",
  "isActive": true
}
```

**Note:** Updating `currentName` automatically closes previous name history and creates new entry.

### Delete Wrestler (Soft Delete) `[ADMIN ONLY]`
```
DELETE /api/wrestlers/:id
```

Sets `isActive` to `false`.

### Get Wrestler Name History
```
GET /api/wrestlers/:id/names
```

---

## Groups

### List All Groups
```
GET /api/groups?brandId=xxx&isActive=true&includeMembers=true
```

**Query Parameters:**
- `brandId` (optional): Filter by brand
- `isActive` (optional): Filter by active status
- `includeMembers` (optional): Include current members with wrestler data

### Get Group
```
GET /api/groups/:id?includeMembers=true
```

### Create Group `[ADMIN ONLY]`
```
POST /api/groups
Content-Type: application/json

{
  "name": "The Usos",
  "brandId": "brand_...",
  "isActive": true,
  "memberIds": ["wrestler_1", "wrestler_2"]
}
```

### Update Group `[ADMIN ONLY]`
```
PATCH /api/groups/:id
Content-Type: application/json

{
  "name": "The Usos Updated",
  "brandId": "brand_...",
  "isActive": true
}
```

### Delete Group (Soft Delete) `[ADMIN ONLY]`
```
DELETE /api/groups/:id
```

### Get Group Members
```
GET /api/groups/:id/members?current=true
```

**Query Parameters:**
- `current` (optional): Only show current members (where `leftAt` is null)

### Add Member to Group `[ADMIN ONLY]`
```
POST /api/groups/:id/members
Content-Type: application/json

{
  "wrestlerId": "wrestler_...",
  "joinedAt": "2024-01-01T00:00:00.000Z"
}
```

### Update Member `[ADMIN ONLY]`
```
PATCH /api/groups/:id/members/:memberId
Content-Type: application/json

{
  "leftAt": "2024-06-01T00:00:00.000Z"
}
```

### Remove Member `[ADMIN ONLY]`
```
DELETE /api/groups/:id/members/:memberId
```

---

## Events

### List All Events
```
GET /api/events?brandId=xxx&status=open&fromDate=2024-01-01&toDate=2024-12-31&includeMatches=true
```

**Query Parameters:**
- `brandId` (optional): Filter by brand
- `status` (optional): Filter by status (`open`/`locked`/`completed`)
- `fromDate` (optional): Filter events from this date
- `toDate` (optional): Filter events to this date
- `includeMatches` (optional): Include match list

### Get Event
```
GET /api/events/:id?includeMatches=true&includeCustomPredictions=true
```

**Query Parameters:**
- `includeMatches` (optional): Include full match data with participants
- `includeCustomPredictions` (optional): Include custom predictions

**Response Example (with includeMatches=true):**
```json
{
  "id": "event_...",
  "name": "WrestleMania 40",
  "brandId": "brand_...",
  "eventDate": "2024-04-07T00:00:00.000Z",
  "status": "open",
  "matches": [
    {
      "id": "match_...",
      "matchType": "singles",
      "matchOrder": 1,
      "participants": [
        {
          "id": "participant_...",
          "side": 1,
          "participantType": "wrestler",
          "participant": {
            "id": "wrestler_...",
            "currentName": "Roman Reigns"
          }
        }
      ]
    }
  ]
}
```

### Create Event `[ADMIN ONLY]`
```
POST /api/events
Content-Type: application/json

{
  "name": "WrestleMania 40",
  "brandId": "brand_...",
  "eventDate": "2024-04-07T00:00:00.000Z",
  "status": "open"
}
```

### Update Event `[ADMIN ONLY]`
```
PATCH /api/events/:id
Content-Type: application/json

{
  "name": "WrestleMania 40 Updated",
  "status": "locked"
}
```

**Status Transitions:**
- `open` → `locked` (event started, predictions closed)
- `locked` → `completed` (results entered, ready to score)

**Error:** Cannot transition backwards or skip states.

### Delete Event `[ADMIN ONLY]`
```
DELETE /api/events/:id
```

**Note:** Hard delete. Cascades to matches and predictions.

---

## Matches

### Create Match `[ADMIN ONLY]`
```
POST /api/matches
Content-Type: application/json

{
  "eventId": "event_...",
  "matchType": "singles",
  "matchOrder": 1,
  "participants": [
    {
      "side": 1,
      "participantType": "wrestler",
      "participantId": "wrestler_1",
      "isChampion": true
    },
    {
      "side": 2,
      "participantType": "wrestler",
      "participantId": "wrestler_2"
    }
  ]
}
```

**Match Types:**
- **Team Match** (1v1, 2v2, 3v3v3, etc.): Use `side` field (1, 2, 3, 4...)
- **Free-for-All** (Battle Royal, Royal Rumble): Set `side` to `null`
- **Royal Rumble**: Additionally set `entryOrder` (1-30)

**Champion Status:**
- Set `isChampion: true` on a participant to indicate they hold a championship at the time of the match

### Get Match
```
GET /api/matches/:id?includeParticipants=true
```

### Update Match (Set Results) `[ADMIN ONLY]`
```
PATCH /api/matches/:id
Content-Type: application/json

{
  "outcome": "winner",
  "winningSide": 1
}
```

**For Team Matches:**
```json
{
  "outcome": "winner",
  "winningSide": 2
}
```

**For Free-for-All:**
```json
{
  "outcome": "winner",
  "winnerParticipantId": "participant_..."
}
```

**Other Outcomes:**
```json
{
  "outcome": "draw"
}
```

**Note:** Can only set results when event is `locked` or `completed`.

### Delete Match `[ADMIN ONLY]`
```
DELETE /api/matches/:id
```

**Note:** Only allowed for `open` events.

### Get Match Participants
```
GET /api/matches/:id/participants
```

### Add Participant `[ADMIN ONLY]`
```
POST /api/matches/:id/participants
Content-Type: application/json

{
  "side": 1,
  "participantType": "wrestler",
  "participantId": "wrestler_...",
  "entryOrder": null,
  "isChampion": false
}
```

### Update Participant `[ADMIN ONLY]`
```
PATCH /api/matches/:id/participants/:participantId
Content-Type: application/json

{
  "side": 2,
  "entryOrder": 15,
  "isChampion": true
}
```

### Remove Participant `[ADMIN ONLY]`
```
DELETE /api/matches/:id/participants/:participantId
```

---

## Match Predictions

### List User's Match Predictions
```
GET /api/predictions/matches?eventId=xxx&matchId=yyy
```

**Query Parameters:**
- `eventId` (optional): Filter by event
- `matchId` (optional): Filter by specific match

### Create/Update Match Prediction
```
POST /api/predictions/matches
Content-Type: application/json

{
  "matchId": "match_...",
  "predictedSide": 1
}
```

**For Team Matches:**
```json
{
  "matchId": "match_...",
  "predictedSide": 2
}
```

**For Free-for-All:**
```json
{
  "matchId": "match_...",
  "predictedParticipantId": "participant_..."
}
```

**Rules:**
- Must provide either `predictedSide` OR `predictedParticipantId` (not both)
- Can only predict when event status is `open`
- Upserting: Creates new prediction or updates existing

### Get Match Prediction
```
GET /api/predictions/matches/:id
```

### Update Match Prediction
```
PATCH /api/predictions/matches/:id
Content-Type: application/json

{
  "predictedSide": 2
}
```

### Delete Match Prediction
```
DELETE /api/predictions/matches/:id
```

---

## Custom Predictions

### Get Event Custom Predictions (Admin)
```
GET /api/events/:id/custom-predictions?includeTemplate=true
```

### Add Custom Prediction to Event (Admin) `[ADMIN ONLY]`
```
POST /api/events/:id/custom-predictions
Content-Type: application/json

{
  "templateId": "template_...",
  "question": "When does Roman Reigns bleed?"
}
```

### Update Custom Prediction (Admin) `[ADMIN ONLY]`
```
PATCH /api/events/:id/custom-predictions/:predictionId
Content-Type: application/json

{
  "question": "Updated question",
  "answerTime": "2024-04-07T22:30:00.000Z",
  "isScored": true
}
```

**Answer Fields by Type:**
- `time`: `answerTime` (ISO 8601 timestamp)
- `count`: `answerCount` (integer)
- `wrestler`: `answerWrestlerId` (wrestler ID)
- `boolean`: `answerBoolean` (true/false)
- `text`: `answerText` (string)

**Note:** Can only set answers when event is `locked` or `completed`.

### Delete Custom Prediction (Admin) `[ADMIN ONLY]`
```
DELETE /api/events/:id/custom-predictions/:predictionId
```

### List User's Custom Predictions
```
GET /api/predictions/custom?eventId=xxx&eventCustomPredictionId=yyy
```

### Create/Update User Custom Prediction
```
POST /api/predictions/custom
Content-Type: application/json

{
  "eventCustomPredictionId": "eventcustompred_...",
  "predictionTime": "2024-04-07T22:15:00.000Z"
}
```

**Prediction Fields by Type:**
- `time`: `predictionTime`
- `count`: `predictionCount`
- `wrestler`: `predictionWrestlerId`
- `boolean`: `predictionBoolean`
- `text`: `predictionText`

### Get Custom Prediction
```
GET /api/predictions/custom/:id
```

### Update Custom Prediction
```
PATCH /api/predictions/custom/:id
Content-Type: application/json

{
  "predictionCount": 5
}
```

### Delete Custom Prediction
```
DELETE /api/predictions/custom/:id
```

---

## Contrarian Mode

### List User's Contrarian Status
```
GET /api/predictions/contrarian?eventId=xxx
```

### Enable/Update Contrarian Mode
```
POST /api/predictions/contrarian
Content-Type: application/json

{
  "eventId": "event_...",
  "isContrarian": true
}
```

**Rules:**
- Can only enable when event is `open`
- Cannot enable after making any predictions for the event
- Goal: Get ALL match predictions wrong to auto-win

### Get Contrarian Status for Event
```
GET /api/predictions/contrarian/:eventId
```

**Response:**
```json
{
  "id": "contrarian_...",
  "userId": "user_...",
  "eventId": "event_...",
  "isContrarian": true,
  "didWinContrarian": null
}
```

### Disable Contrarian Mode
```
DELETE /api/predictions/contrarian/:eventId
```

---

## Scoring & Results

### Score Event `[ADMIN ONLY]`
```
POST /api/events/:id/score
```

**Description:** Calculates all prediction scores for a completed event.

**Process:**
1. Scores all match predictions
2. Scores all custom predictions
3. Determines contrarian winners

**Response:**
```json
{
  "message": "Event scored successfully",
  "matchPredictionsScored": 50,
  "customPredictionsScored": 20,
  "contrarianScored": 3
}
```

**Note:** Can only score `completed` events.

### Get Event Leaderboard
```
GET /api/events/:id/score?userId=xxx
```

**Query Parameters:**
- `userId` (optional): Get score for specific user only

**Response (Leaderboard):**
```json
[
  {
    "userId": "user_1",
    "matchPredictions": {
      "total": 10,
      "correct": 8
    },
    "customPredictions": {
      "total": 5,
      "correct": 3
    },
    "totalScore": 11,
    "isContrarian": false,
    "didWinContrarian": null
  },
  {
    "userId": "user_2",
    "matchPredictions": {
      "total": 10,
      "correct": 0
    },
    "customPredictions": {
      "total": 5,
      "correct": 0
    },
    "totalScore": 0,
    "isContrarian": true,
    "didWinContrarian": true
  }
]
```

**Sorting:**
1. Contrarian winners first (`didWinContrarian: true`)
2. Then by `totalScore` (descending)

---

## Event Workflow Example

### 1. Create Event (Admin)
```bash
POST /api/events
{
  "name": "WrestleMania 40",
  "brandId": "brand_wwe",
  "eventDate": "2024-04-07T00:00:00.000Z",
  "status": "open"
}
```

### 2. Add Matches (Admin)
```bash
POST /api/matches
{
  "eventId": "event_wm40",
  "matchType": "singles",
  "matchOrder": 1,
  "participants": [
    { "side": 1, "participantType": "wrestler", "participantId": "roman", "isChampion": true },
    { "side": 2, "participantType": "wrestler", "participantId": "cody" }
  ]
}
```

### 3. Add Custom Predictions (Admin)
```bash
POST /api/events/event_wm40/custom-predictions
{
  "templateId": "template_first_blood",
  "question": "When does Roman Reigns bleed?"
}
```

### 4. Users Make Predictions
```bash
# Match prediction
POST /api/predictions/matches
{
  "matchId": "match_1",
  "predictedSide": 2
}

# Custom prediction
POST /api/predictions/custom
{
  "eventCustomPredictionId": "eventcustompred_1",
  "predictionTime": "2024-04-07T22:15:00.000Z"
}

# Optional: Enable contrarian mode
POST /api/predictions/contrarian
{
  "eventId": "event_wm40",
  "isContrarian": true
}
```

### 5. Lock Event (Admin - Event Starts)
```bash
PATCH /api/events/event_wm40
{
  "status": "locked"
}
```

### 6. Enter Match Results (Admin - During/After Event)
```bash
PATCH /api/matches/match_1
{
  "outcome": "winner",
  "winningSide": 2
}
```

### 7. Enter Custom Prediction Answers (Admin)
```bash
PATCH /api/events/event_wm40/custom-predictions/eventcustompred_1
{
  "answerTime": "2024-04-07T22:30:00.000Z",
  "isScored": true
}
```

### 8. Complete Event (Admin)
```bash
PATCH /api/events/event_wm40
{
  "status": "completed"
}
```

### 9. Score Event (Admin)
```bash
POST /api/events/event_wm40/score
```

### 10. View Leaderboard
```bash
GET /api/events/event_wm40/score
```

---

## Settings `[ADMIN ONLY]`

Application settings stored as key-value pairs. See [Settings.md](Settings.md) for architecture details.

### List All Settings
```
GET /api/settings?namespace=auth
```

**Query Parameters:**
- `namespace` (optional): Filter by namespace prefix (e.g., `auth`, `predictions`)

**Response:**
```json
[
  {
    "key": "auth.signupEnabled",
    "scope": "global",
    "type": "boolean",
    "value": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Get Setting
```
GET /api/settings/:key
```

**Response:**
```json
{
  "key": "auth.signupEnabled",
  "value": false
}
```

### Create/Update Setting
```
POST /api/settings
Content-Type: application/json

{
  "key": "auth.signupEnabled",
  "type": "boolean",
  "value": true
}
```

**Setting Types:**
- `string` - Plain text
- `boolean` - true/false
- `number` - Numeric value
- `json` - Complex objects/arrays (validated against schema if defined)

### Delete Setting
```
DELETE /api/settings/:key
```

---

## Users `[ADMIN ONLY]`

User management endpoints for administrators.

### List All Users
```
GET /api/users?search=john&isAdmin=true
```

**Query Parameters:**
- `search` (optional): Search by email or name
- `isAdmin` (optional): Filter by admin status (`true`/`false`)
- Standard pagination parameters (`page`, `limit`, `sortBy`, `sortOrder`)

### Get User
```
GET /api/users/:id
```

### Create User
```
POST /api/users
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe",
  "isAdmin": false
}
```

### Update User
```
PATCH /api/users/:id
Content-Type: application/json

{
  "name": "John Updated",
  "isAdmin": true
}
```

**Note:** Cannot remove your own admin privileges (returns 403).

### Delete User
```
DELETE /api/users/:id
```

**Note:** Cannot delete yourself (returns 403).

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (not logged in) |
| 403 | Forbidden (admin access required, or self-modification blocked) |
| 404 | Not Found |
| 409 | Conflict (duplicate resource) |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |

---

## Auto-Refresh Compatibility

All endpoints support polling for auto-refresh functionality:

1. **List Endpoints** - Poll to detect new items
2. **GET Endpoints** - Poll to detect updates
3. **Leaderboard** - Poll during live events for real-time updates

**Recommended Polling Intervals:**
- Event list: 30 seconds
- Event details (during live event): 10 seconds
- Leaderboard (during scoring): 5 seconds
- Other endpoints: 60 seconds

**Optimization Tips:**
- Use query parameters to filter data
- Only request `include*` parameters when needed
- Use `userId` parameter for user-specific data
- Implement exponential backoff on errors

---

## TypeScript Types

See `app/lib/schema.ts` for full Drizzle schema definitions. All API responses use these exact types (with Date objects serialized as ISO 8601 strings in JSON).

---

**Last Updated:** 2026-02-03
