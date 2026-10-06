---
name: design-polish
description: Use when achieving pixel-perfect implementations, matching designs exactly, or fixing spacing/alignment issues.
---

> **Prototype note.** This is the app's skill, cloned verbatim into the prototype. Read `../design-system/prototype.md` FIRST — and note §6: when the design you are matching is a screen the dashboard already has, the reference is the app's own implementation, not a screenshot of it.

> **Tokens, not hex.** When matching a design, map every value to a `--core-*` token (the 5 C's in `../design-system/building.md`), never a raw hex/px copied from Figma — raw values break light/dark parity and violate the token contract. Measure rendered values; see `../design-system/pitfalls.md` §3.

# Design Polish

## When to Use

- Matching Figma designs exactly
- Fixing spacing or alignment issues
- Refining visual details
- Preparing for design review

## Strategy

- Measure EVERYTHING (spacing, sizes, colors, shadows)
- Use Playwright for visual regression testing
- Compare side-by-side with design reference
- Fix issues one property at a time
- Validate at multiple viewport sizes

## Workflow

### 1. Capture Reference
- If Figma URL provided: use `mcp__figma__get_screenshot` for specific node
- Note exact measurements: spacing, font sizes, colors, shadows, borders
- Document in a checklist format

### 2. Capture Current State
```typescript
await page.screenshot({ path: 'current.png' })
```

### 3. Compare and Document Differences
Create a checklist of discrepancies:
- [ ] Font size: expected Xpx, actual Ypx
- [ ] Padding: expected Xpx, actual Ypx
- [ ] Color: expected #XXX, actual #YYY
- [ ] Border radius: expected Xpx, actual Ypx

### 4. Fix Systematically
- One property at a time
- Screenshot after each change
- Verify no regressions

### 5. Final Validation
- Side-by-side comparison
- Check all breakpoints (mobile, tablet, desktop)
- User review if requested

## Common Issues

### Spacing
- Check margin vs padding confusion
- Verify gap values in flex/grid containers
- Compare against design system tokens

### Typography
- Verify font-family, size, weight, line-height
- Check letter-spacing if specified
- Ensure correct text color

### Colors
- Use exact hex values from design system
- Check opacity if colors seem off
- Verify hover/active states

### Alignment
- Use browser DevTools to inspect
- Check flex alignment properties
- Verify centering methods

## Output

- Pixel-perfect implementation
- Before/after screenshots
- Visual regression test (if applicable)
- Summary of changes made
