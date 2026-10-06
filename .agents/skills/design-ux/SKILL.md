---
name: design-ux
description: Use when implementing features with multiple states, user journeys, or comprehensive UX coverage requirements.
---

> **Prototype note.** This is the app's skill, cloned verbatim into the prototype. Read `../design-system/prototype.md` FIRST for what reads differently here.

# UX Flow Coverage

## When to Use

- Features with multiple states
- Complex user journeys
- Components needing thorough scenario coverage
- Pre-release UX validation

## Strategy

- Map out ALL possible states before coding
- Think about the complete user journey
- Test every scenario with Playwright
- Consider loading, empty, error, and edge states
- Validate accessibility and keyboard navigation

## State Checklist

Apply to every feature:

- [ ] Empty state (no data)
- [ ] Loading state (fetching)
- [ ] Partial data state
- [ ] Full/populated state
- [ ] Error state (API failure)
- [ ] Disabled/locked state
- [ ] Mobile/responsive state
- [ ] Hover/focus/active states
- [ ] Success/confirmation state

## User Journey Mapping

Before implementation, document:

1. **Entry points** - How does the user get here?
2. **Happy path** - What's the ideal flow?
3. **Alternative paths** - What other routes exist?
4. **Exit points** - Where can the user go next?
5. **Error recovery** - What if something goes wrong?

## Accessibility Checklist

- [ ] Semantic HTML elements
- [ ] ARIA labels for interactive elements
- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] Focus management for modals/dialogs
- [ ] Color contrast compliance
- [ ] Screen reader compatibility

## Testing Workflow

1. Create Playwright test file for the feature
2. Test each state systematically
3. Capture screenshots at each breakpoint
4. Test keyboard navigation
5. Verify loading/transition animations

## Common UX Patterns

### Data Tables
- Empty state message
- Loading skeleton
- Error with retry action
- Pagination/infinite scroll
- Sort/filter feedback

### Forms
- Validation feedback (inline vs submit)
- Loading state on submit
- Success confirmation
- Error recovery guidance

### Modals/Dialogs
- Focus trap
- Escape to close
- Click outside to close
- Return focus on close

## Output

- Feature implementation with all states handled
- Playwright tests covering all scenarios
- Screenshots documenting each state
- List of edge cases and how they're handled
