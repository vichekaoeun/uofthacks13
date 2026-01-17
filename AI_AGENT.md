# AI Agent Reference

## Project
HereAndNow — location-based memories on a map (hackathon MVP).

## MVP Scope
- Map with nearby memories.
- Create memory (text-first; media optional).
- Basic thread/rewind view.
- AI summary stub for “location vibe.”

## Fast Iteration Rules
- Prefer mocks and stubs over full integrations.
- Keep API surface minimal.
- Ship UI flows before deep backend features.

## Data Model (draft)
- `User`: id, displayName
- `Memory`: id, userId, text, mediaUrl?, createdAt, location { lat, lng }, coreLocationId?
- `Thread`: id, memoryIds, coreLocationId
- `CoreLocation`: id, name, center { lat, lng }, radius

## API (draft)
- `POST /memories`
- `GET /memories/nearby?lat=&lng=&radius=`
- `GET /threads/:id`
- `GET /core-locations/:id/summary` (stub)
- Realtime event: `memories:new`

## Notes
- Use MongoDB geospatial indexes on memory locations.
- Core-location “flag” groups memories for summaries.
- AI summary can be canned text during demo.
