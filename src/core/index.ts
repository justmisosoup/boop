// TRIMMED BARREL — local modification, recorded in PARITY.md.
//
// The app's index.ts is the full public API and pulls in react-router,
// react-redux, react-select, sonner and the rest of the dashboard's dependency
// tail. This prototype re-exports only the primitives it consumes; the files
// themselves are unmodified clones.

export {
  ConfidenceBadge,
  CountBubble,
  EntityStateBadge,
  EvidenceBadge,
  MetaChip,
  OutcomeBadge,
  RiskDot,
  RiskSeverityBadge,
  VerificationOutcomeBadge
} from './Badge'
export type {
  ConfidenceLevel,
  EntityState,
  EvidenceQuality,
  MetaChipSize,
  MetaChipTone,
  OutcomeSentiment,
  RiskSeverity
} from './Badge'
export { ActionButton, ActionLink, IconActionButton } from './Action'
export type {
  ActionButtonProps,
  ActionLinkProps,
  ActionSize,
  ActionVariant,
  IconActionButtonProps
} from './Action'
export {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Textarea
} from './Field'
export type { FieldProps, InputProps, TextareaProps } from './Field'
export { ChatSourceChip, ChatSources } from './ChatSources'
export type { ChatSourceData } from './ChatSources'
export { CoreThemeProvider, useCoreThemeMode } from './CoreTheme'
export type { CoreThemeMode } from './CoreTheme'
export { HoverCard, HoverCardContent, HoverCardTrigger } from './HoverCard'
export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from './Popover'
export {
  TabsContent,
  TabsCount,
  TabsList,
  Tabs as TabsRoot,
  TabsTrigger
} from './TabsPrimitive'
export type { TabsContentProps, TabsListProps, TabsProps, TabsTriggerProps } from './TabsPrimitive'
export { EmptyState, ErrorState, InlineAlert, LoadingRegion, Skeleton } from './FeedbackState'
export type { EmptyStateProps, ErrorStateProps, FeedbackTone, InlineAlertProps, LoadingRegionProps } from './FeedbackState'
export {
  ChatAttachment,
  ChatComposer,
  ChatLog,
  ChatMarker,
  ChatMessage,
  ChatMessageActions,
  ChatSuggestions
} from './Chat'
export type { ChatChipData } from './Chat'
export type { Density } from './internal/density'
export { ChatThinking } from './ChatThinking'
export type { ChatThinkingStep, ChatThinkingStepStatus } from './ChatThinking'
export { Spinner } from './Spinner'
export { Tag } from './Tag'
export type { TagProps, TagSize, TagTone } from './Tag'
export {
  CodeText,
  ErrorText,
  Heading,
  HelperText,
  LabelText,
  MutedText,
  Section,
  Surface,
  Text
} from './Surface'
export type {
  HeadingLevel,
  HeadingProps,
  SectionProps,
  SurfacePadding,
  SurfaceProps,
  SurfaceVariant,
  TextProps,
  TextSize,
  TextTone
} from './Surface'
