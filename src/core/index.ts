// This file is the PUBLIC INTERFACE of the `@/core` design system, not a
// convenience barrel. Adding an export here is an API decision: it needs an
// intentional, stable name, tokenized + accessible + light/dark-parity styling,
// a workbench specimen, and NO product coupling (no product data, copy, routes,
// or single-page orchestration). Page/product-specific compositions stay in
// `components/`/`containers/` and compose these primitives instead. See the
// `design-system` skill for the decision tree before adding here.

import DateTime from './DateTime'
import Dropdown from './Dropdown'
import Dropzone from './Dropzone'
import * as Icons from './Icons'
import List from './List'
import Loader from './Loader'
import MetaTag, { MetaTags } from './MetaTag'
import ListPagination from './Pagination'
import Search from './Search'
import SelectedDropdown from './SelectedDropdown'
import * as theme from './theme'

export { Attribute } from './Attribute'
export { Banner } from './Banner'
export { Bubble } from './Bubble'
export { Button } from './Button'
export { ActionButton, ActionLink, IconActionButton } from './Action'
export type {
  ActionButtonProps,
  ActionLinkProps,
  ActionSize,
  ActionVariant,
  IconActionButtonProps
} from './Action'
export { CopyButton } from './CopyButton'
export type { CopyButtonProps } from './CopyButton'
export {
  ConfidenceBadge,
  CountBubble,
  EntityStateBadge,
  EvidenceBadge,
  MetaChip,
  OutcomeBadge,
  RiskDot,
  RiskSeverityBadge,
  VerificationOutcomeBadge,
  WorkflowStatusBadge,
  toConfidenceLevel,
  toEvidenceQuality,
  toOutcomeSentiment,
  toRiskSeverity,
  toWorkflowStatus
} from './Badge'
export type {
  ConfidenceLevel,
  EntityState,
  EvidenceQuality,
  MetaChipSize,
  MetaChipTone,
  OutcomeSentiment,
  RiskSeverity,
  WorkflowStatus
} from './Badge'
export { Tag } from './Tag'
export type { TagProps, TagSize, TagTone } from './Tag'
export { TokenInput } from './TokenInput'
export type { TokenInputProps } from './TokenInput'
export { Avatar } from './Avatar'
export type { AvatarProps, AvatarSize } from './Avatar'
export { ButtonIcon } from './ButtonIcon'
export { Card } from './Card'
export { CoreThemeProvider, useCoreThemeMode } from './CoreTheme'
export type { CoreThemeMode } from './CoreTheme'
export {
  AppShellBrandMark,
  AppShellLayout,
  AppShellMain,
  AppShellNav,
  AppShellNavCollapsible,
  AppShellNavGroup,
  AppShellNavGroupButton,
  AppShellNavItem,
  AppShellNavSection,
  AppShellNavSectionLabel,
  AppShellRoot,
  AppShellSearchPanel,
  AppShellSearchResult,
  AppShellSearchRoot,
  AppShellSearchTrigger,
  AppShellSidebar,
  AppShellSidebarHeader,
  AppShellSubNavItem,
  AppShellTopbar,
  AppShellTopbarContent
} from './AppShell'
export type {
  AppShellBrandMarkProps,
  AppShellLayoutProps,
  AppShellMainProps,
  AppShellNavCollapsibleProps,
  AppShellNavItemProps,
  AppShellNavGroupButtonProps,
  AppShellNavGroupProps,
  AppShellNavProps,
  AppShellNavSectionLabelProps,
  AppShellNavSectionProps,
  AppShellRootProps,
  AppShellSearchPanelProps,
  AppShellSearchResultProps,
  AppShellSearchRootProps,
  AppShellSearchTriggerProps,
  AppShellSidebarHeaderProps,
  AppShellSidebarProps,
  AppShellSubNavItemProps,
  AppShellThemeMode,
  AppShellTopbarContentProps,
  AppShellTopbarProps
} from './AppShell'
export {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPanel
} from './Dialog'
export type {
  DialogBodyProps,
  DialogFooterProps,
  DialogHeaderProps,
  DialogOverlayProps,
  DialogPanelProps,
  DialogProps,
  DialogSize
} from './Dialog'
export { ConfirmDialog } from './ConfirmDialog'
export { ProductAnnouncement } from './ProductAnnouncement'
export type {
  ProductAnnouncementBannerProps,
  ProductAnnouncementBodyProps,
  ProductAnnouncementCtaConfig,
  ProductAnnouncementNavProps,
  ProductAnnouncementPagerProps,
  ProductAnnouncementProps
} from './ProductAnnouncement'
export type { ConfirmDialogProps, ConfirmDialogTone } from './ConfirmDialog'
export {
  createDataTableColumnHelper,
  DataTable,
  DataTableEmptyState,
  DataTableErrorState,
  DataTableLoadingState,
  DataTableRowActions
} from './DataTable'
export type {
  DataTableColumnDef,
  DataTableDensity,
  DataTablePaginationState,
  DataTableProps,
  DataTableRowAction,
  DataTableRowIntent,
  DataTableSortState
} from './DataTable'
export { Checkbox, RadioGroup, RadioItem } from './ChoiceControl'
export type {
  CheckboxProps,
  RadioGroupProps,
  RadioItemProps
} from './ChoiceControl'
export { Combobox } from './Combobox'
export type { ComboboxOption, ComboboxProps } from './Combobox'
export { Drawer } from './Drawer'
export type {
  DrawerPresentation,
  DrawerProps,
  DrawerResizeOptions,
  DrawerSide,
  DrawerSize
} from './Drawer'
// The composable set for an agent chat surface (Chat.tsx plus the sibling
// modules ChatSources.tsx and ChatThinking.tsx). Atoms the components own
// internally (a single chip, one action button, a preview card, a step row)
// are deliberately NOT exported — consumers drive them through props/data,
// keeping the public surface to what you compose a conversation from. Prop
// types stay internal too (inferable via React.ComponentProps if a wrapper
// ever needs them); the exported types are the data contracts you hand in —
// including the step-status union, which wire→primitive mappers must name.
export {
  ChatAttachment,
  ChatComposer,
  ChatLog,
  ChatMarker,
  ChatMessage,
  ChatMessageActions,
  ChatSuggestions
} from './Chat'
export type {
  ChatAttachmentData,
  ChatChipData,
  ChatMessageActionItem,
  ChatSlashGroup,
  ChatSlashItem,
  ChatSuggestion
} from './Chat'
export { ChatSourceChip, ChatSources } from './ChatSources'
export type { ChatSourceData } from './ChatSources'
export { ChatThinking } from './ChatThinking'
export type { ChatThinkingStep, ChatThinkingStepStatus } from './ChatThinking'
// Deprecated styled-components drawer, kept for its remaining consumers (Sandbox
// scenario + RiskyKeywords) until they migrate to the new Drawer.
export { Drawer as LegacyDrawer } from './LegacyDrawer'
export { FacetFilter } from './FacetFilter'
export type { FacetFilterOption, FacetFilterProps } from './FacetFilter'
export {
  FLOATING_PANEL_INSET_PX,
  FLOATING_PANEL_WINDOW_WIDTH,
  FloatingPanel,
  FloatingPanelBody,
  FloatingPanelFooter,
  FloatingPanelHeader,
  FloatingPanelRow,
  FloatingPanelRowsSkeleton,
  FloatingPanelTitle,
  FloatingPanelTitleSwitcher
} from './FloatingPanel'
// The system-wide density axis (currently adopted by FloatingPanel + Chat).
// Only the TYPE is public: `FloatingPanel` is the injection point — the
// provider/hook stay internal so density can't be set from arbitrary wrappers.
export type { Density } from './internal/density'
export type { PanelRowLeading } from './internal/panelRow'
export type {
  FloatingPanelBodyProps,
  FloatingPanelCorner,
  FloatingPanelFooterProps,
  FloatingPanelHeaderProps,
  // referenced by `FloatingPanelProps` — exported so consumers can type a
  // `presentation` / `resizable` value without reaching into the module
  FloatingPanelPresentation,
  FloatingPanelProps,
  FloatingPanelResizeOptions,
  FloatingPanelRowProps,
  FloatingPanelRowsSkeletonProps,
  FloatingPanelSide,
  FloatingPanelState,
  FloatingPanelTitleProps,
  FloatingPanelTitleSwitcherProps
} from './FloatingPanel'
export {
  ArrayField,
  FormControl,
  FormError,
  FormField,
  FormCheckboxField,
  FormRadioField,
  FormSelectField,
  FormTextField,
  Form,
  getSubmitState,
  useMiddeskForm,
  useFormContext
} from './Form'
export type {
  FormControlField,
  FormControlProps,
  FormControlRenderArg
} from './Form'
export { Icon } from './Icon'
export { IconLabel } from './IconLabel'
export { Kbd } from './Kbd'
export type { KbdProps } from './Kbd'
export { Highlight } from './Highlight'
export type { HighlightProps } from './Highlight'
export { ListPicker } from './ListPicker'
export type {
  ListPickerAction,
  ListPickerItem,
  ListPickerProps
} from './ListPicker'
export { Link } from './Link'
export { Markdown } from './Markdown'
export type { MarkdownProps } from './Markdown'
export {
  EmptyState,
  ErrorState,
  InlineAlert,
  LoadingRegion,
  Skeleton
} from './FeedbackState'
export type {
  EmptyStateProps,
  ErrorStateProps,
  FeedbackTone,
  InlineAlertProps,
  LoadingRegionProps
} from './FeedbackState'
export { SkeletonPage } from './SkeletonPage'
export type { SkeletonPageProps } from './SkeletonPage'
export { Spinner } from './Spinner'
export type { SpinnerProps, SpinnerSize, SpinnerTone } from './Spinner'
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
export {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Textarea
} from './Field'
export type { FieldProps, InputProps, TextareaProps } from './Field'
export { HelpIcon, Hint, HintContent, HintProvider, HintTrigger } from './Hint'
export type {
  HelpIconProps,
  HintAlign,
  HintContentProps,
  HintProps,
  HintProviderProps,
  HintSide,
  HintTriggerProps
} from './Hint'
export { HoverCard, HoverCardContent, HoverCardTrigger } from './HoverCard'
export type { HoverCardContentProps } from './HoverCard'
export {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuLabel,
  MenuPortal,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger
} from './Menu'
export type {
  MenuCheckboxItemProps,
  MenuContentProps,
  MenuItemProps,
  MenuLabelProps,
  MenuRadioItemProps,
  MenuSubTriggerProps
} from './Menu'
export { Modal } from './Modal'
export {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger
} from './Popover'
export type { PopoverContentProps } from './Popover'
export { SearchInput } from './SearchInput'
export type { SearchInputProps } from './SearchInput'
export { SegmentedControl, SegmentedControlItem } from './SegmentedControl'
export type {
  SegmentedControlItemProps,
  SegmentedControlProps,
  SegmentedControlSize
} from './SegmentedControl'
export { Slider } from './Slider'
export type { SliderProps } from './Slider'
export { SourceView } from './SourceView'
export type { SourceLanguage } from './SourceView'
export { Switch } from './Switch'
export { Toggle } from './Toggle'
export type { ToggleProps } from './Toggle'
export { Tab, Tabs } from './Tabs'
// New Radix-backed Tabs primitive (the DS replacement for the legacy `Tabs`).
// The Root is exported as `TabsRoot` while the legacy `Tabs` is still on the
// barrel for the ~16 existing consumers; promote to `Tabs` once those migrate.
// Overflow is built in: triggers that don't fit collapse into a "More" menu;
// mark a trigger `overflow='fixed'` to file it there permanently.
export {
  TabsContent,
  TabsCount,
  TabsList,
  Tabs as TabsRoot,
  TabsTrigger
} from './TabsPrimitive'
export type {
  TabsContentProps,
  TabsCountProps,
  TabsListProps,
  TabsProps,
  TabsTriggerProps
} from './TabsPrimitive'
// Content-chrome: the page-level shell (header / toolbar / metric cards) that
// lives inside AppShellMain. Compose the Tabs primitive above for the tab bar.
export {
  MetricCard,
  MetricCardGroup,
  MetricDelta,
  PageBreadcrumb,
  PageBreadcrumbItem,
  PageBreadcrumbSwitcher,
  PageContainer,
  PageDescription,
  PageHeader,
  PageHeaderActions,
  PageHeaderBand,
  PageHeaderBar,
  PageHeaderTitles,
  PageHeading,
  PageHeadingCount,
  Toolbar,
  ToolbarButton,
  ToolbarCount,
  ToolbarSection,
  ToolbarSeparator,
  ToolbarSpacer
} from './PageChrome'
export type {
  MetricCardGroupProps,
  MetricCardProps,
  MetricDeltaProps,
  PageBreadcrumbItemProps,
  PageBreadcrumbProps,
  PageBreadcrumbSwitcherProps,
  PageContainerProps,
  PageDescriptionProps,
  PageHeaderActionsProps,
  PageHeaderBandProps,
  PageHeaderBarProps,
  PageHeaderProps,
  PageHeaderTitlesProps,
  PageHeadingCountProps,
  PageHeadingProps,
  ToolbarButtonProps,
  ToolbarCountProps,
  ToolbarProps,
  ToolbarSectionProps,
  ToolbarSeparatorProps,
  ToolbarSpacerProps
} from './PageChrome'
export { TextTooltip, Tooltip } from './Tooltip'
export { TruncatedText } from './TruncatedText'
export type { TruncatedTextProps } from './TruncatedText'
export {
  semanticColors,
  semanticColorTokens,
  semanticRadius,
  semanticSpacing,
  semanticTypography,
  tokenVar
} from './tokens'
export type {
  SemanticColorToken,
  SemanticRadiusToken,
  SemanticSpacingToken,
  SemanticTypographyToken
} from './tokens'
export { Toaster, useToast } from './Toast'
export { PayloadViewer, PayloadViewerSkeleton } from './PayloadViewer'
export type {
  PayloadViewerProps,
  PayloadViewerSkeletonProps
} from './PayloadViewer'

export {
  DateTime,
  Dropdown,
  Dropzone,
  Icons,
  List,
  ListPagination,
  Loader,
  MetaTag,
  MetaTags,
  Search,
  SelectedDropdown,
  theme
}

export type { BubbleProps } from './Bubble'
export type { ButtonProps } from './Button'
export type { DropzoneFile } from './Dropzone'
export type { IconName, IconProps } from './Icon'
export type { LinkProps } from './Link'
