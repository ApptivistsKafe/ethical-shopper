## Current Session Context

[2025-06-14 01:27 EDT]

## Recent Changes

- Created new `ethicalStatus.ts` constants file:
  - Added `EthicalStatus` enum with proper JSDoc comments
  - Added `getEthicalStatusColor` helper function
  - Values: Excellent, Good, Mixed, Concerning, Poor
- Updated `ProductCard.tsx`:
  - Imported and used new EthicalStatus enum
  - Refactored getEthicalIconBadge to use enum constants
  - Separated color logic into getEthicalStatusColor function

## Current Goals

- Maintain consistent type usage across the application
- Ensure proper documentation of types and interfaces
- Reduce code duplication

## Open Questions

None at this time
