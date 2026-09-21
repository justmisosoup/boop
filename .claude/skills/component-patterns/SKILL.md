---
name: component-patterns
description: Use when creating or modifying React components. Covers styling, hooks, structure, and conventions.
---

> **Prototype note.** This is the app's skill, cloned verbatim into the prototype. Read `../design-system/prototype.md` FIRST — and §4 in particular: the legacy styled-components + `theme.ts` stack this skill routes to **does not exist here**. Use this for React mechanics only; every visual value is a `--core-*` token.

> **Foundation note.** This skill covers React mechanics and the *legacy* styling stack (styled-components + `theme.ts`). For **new** dashboard UI, build on the `@/core` design system instead — start at the **design-system** skill (recipes in `../design-system/building.md`). Use this for component structure / hooks / props conventions, not for choosing a styling foundation.

# Component Patterns

## Component Structure

### Rules
- **Functional components only** (enforced by eslint)
- No class components
- No trailing whitespace
- No comments unless explicitly requested

### Event Handler Naming
Use `on{ActionName}` pattern:
```typescript
interface Props {
  onSubmit: () => void
  onNewThing: (item: Item) => void
  onMouseEnter?: () => void
}
```

## Styling Approach

### Decision Tree
1. **New isolated component?** → Tailwind
2. **Extending existing styled-components?** → styled-components
3. **In Operator/Assistant area?** → Tailwind
4. **In legacy containers/components?** → styled-components

### Styled-Components
```typescript
import styled from 'styled-components'
import { theme } from '@middesk/components'

const Container = styled.div`
  color: ${theme.colors.graphite};
  padding: ${theme.spacing.medium};
`
```

### Transient Props
Use `$` prefix to avoid DOM warnings:
```typescript
const Button = styled.button<{ $isActive: boolean }>`
  background: ${({ $isActive }) => $isActive ? 'blue' : 'gray'};
`

<Button $isActive={true}>Click me</Button>
```

### Tailwind
```typescript
import { cn } from 'utils/twUtils'

<div className={cn(
  'flex items-center gap-4',
  isActive && 'bg-dawn'
)} />
```

## Common Wrapper Patterns

### Feature Flags
```typescript
import { WithFeature } from 'components/Feature'

<WithFeature flag="new_dashboard">
  <NewDashboard />
</WithFeature>
```

### Role-Based Access
```typescript
import { Privileged } from 'components/Privileged'

<Privileged roles={['admin', 'analyst']}>
  <AdminPanel />
</Privileged>
```

### Route Protection
```typescript
import { PrivateRoute } from 'components/PrivateRoute'

<PrivateRoute>
  <ProtectedPage />
</PrivateRoute>
```

## Hooks Usage

### Custom Hooks Location
Custom hooks live in `src/hooks/`.

### Common Hooks
| Hook | Purpose |
|------|---------|
| `useQueryParams` | URL query handling |
| `useContainerWidth` | Responsive width tracking |
| `useStaticBusiness` | Business data caching |
| `useAlertOnExitBeforeSave` | Unsaved changes warning |

### Hook Rules
- Only call at top level
- Only call in function components
- Name with `use` prefix

## Props Patterns

### Destructure in Parameters
```typescript
const MyComponent = ({ title, onSubmit, children }: Props) => {
  // ...
}
```

### Default Values
```typescript
const MyComponent = ({
  variant = 'primary',
  size = 'medium'
}: Props) => {
  // ...
}
```

### Spread Remaining Props
```typescript
const Button = ({ variant, ...rest }: ButtonProps) => (
  <StyledButton $variant={variant} {...rest} />
)
```

## File Organization

### Component Directory Structure
```
src/components/MyComponent/
├── index.tsx        # Main component, exports
├── styles.ts        # styled-components (if used)
├── types.ts         # TypeScript interfaces
└── __tests__/       # Tests
```

### Imports Order (enforced by eslint)
1. Builtin (react, react-dom)
2. External (npm packages)
3. Internal (@ aliases, relative)
