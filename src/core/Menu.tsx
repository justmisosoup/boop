import React from 'react'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { cva, type VariantProps } from 'class-variance-authority'
import { Check, ChevronRight, Minus } from 'lucide-react'

import { cn } from '@/utils/twUtils'

import { useCoreThemeMode, type CoreThemeMode } from './CoreTheme'

export const Menu = DropdownMenu.Root
export const MenuTrigger = DropdownMenu.Trigger
export const MenuGroup = DropdownMenu.Group
export const MenuPortal = DropdownMenu.Portal
export const MenuSub = DropdownMenu.Sub
export const MenuRadioGroup = DropdownMenu.RadioGroup

const menuContentVariants = cva(
  [
    'core-theme core-menu-content z-50 min-w-44 overflow-hidden rounded-popover',
    'border border-border bg-popover text-popover-foreground',
    'shadow-elevation-popover',
    'data-[state=open]:animate-popover-in',
    'data-[state=closed]:animate-popover-out'
  ],
  {
    variants: {
      size: {
        compact: 'core-menu-content-compact text-sm',
        standard: 'core-menu-content-standard text-sm'
      }
    },
    defaultVariants: {
      size: 'compact'
    }
  }
)

export type MenuContentProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenu.Content
> &
  VariantProps<typeof menuContentVariants> & {
    /**
     * Portaled content cannot inherit a scoped `.core-theme[data-theme]` root.
     * Defaults to the nearest core theme context; pass `themeMode` only for isolated specimens.
     */
    themeMode?: CoreThemeMode
  }

export const MenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenu.Content>,
  MenuContentProps
>(({ className, sideOffset = 6, size = 'compact', themeMode, ...props }, ref) => {
  const inheritedThemeMode = useCoreThemeMode()
  const resolvedThemeMode = themeMode ?? inheritedThemeMode

  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        ref={ref}
        className={cn(menuContentVariants({ size }), className)}
        data-size={size}
        data-theme={resolvedThemeMode === 'dark' ? 'dark' : undefined}
        sideOffset={sideOffset}
        {...props}
      />
    </DropdownMenu.Portal>
  )
})

MenuContent.displayName = 'MenuContent'

const menuItemVariants = cva(
  [
    'core-menu-item relative flex cursor-pointer select-none items-center gap-2 rounded-control',
    'outline-hidden transition-colors',
    'focus:bg-[var(--core-color-state-hover-bg)] focus:text-foreground',
    'data-[highlighted]:bg-[var(--core-color-state-hover-bg)] data-[highlighted]:text-foreground',
    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&>svg]:size-4'
  ],
  {
    variants: {
      size: {
        compact: 'min-h-8 px-2 py-1.5 text-sm',
        standard: 'min-h-9 px-2.5 py-2 text-sm'
      },
      tone: {
        neutral: 'text-foreground',
        destructive:
          'text-[var(--core-color-text-danger)] data-[highlighted]:bg-[var(--core-color-status-danger-bg)] data-[highlighted]:text-[var(--core-color-text-danger)] focus:bg-[var(--core-color-status-danger-bg)] focus:text-[var(--core-color-text-danger)]'
      },
      inset: {
        true: 'pl-8',
        false: ''
      }
    },
    defaultVariants: {
      size: 'compact',
      tone: 'neutral',
      inset: false
    }
  }
)

export type MenuItemProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenu.Item
> &
  VariantProps<typeof menuItemVariants>

export const MenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenu.Item>,
  MenuItemProps
>(({ className, inset = false, size = 'compact', tone = 'neutral', ...props }, ref) => (
  <DropdownMenu.Item
    ref={ref}
    className={cn(menuItemVariants({ inset, size, tone }), className)}
    data-size={size}
    {...props}
  />
))

MenuItem.displayName = 'MenuItem'

export type MenuCheckboxItemProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenu.CheckboxItem
> &
  VariantProps<typeof menuItemVariants> & {
    /** Keep checkbox menus open by default so repeated filter/preference toggles are possible. */
    closeOnSelect?: boolean
  }

export const MenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenu.CheckboxItem>,
  MenuCheckboxItemProps
>(
  (
    {
      children,
      className,
      checked,
      closeOnSelect = false,
      onSelect,
      size = 'compact',
      ...props
    },
    ref
  ) => (
    <DropdownMenu.CheckboxItem
      ref={ref}
      checked={checked}
      className={cn(menuItemVariants({ size }), 'pl-8', className)}
      data-size={size}
      onSelect={(event) => {
        if (!closeOnSelect) event.preventDefault()
        onSelect?.(event)
      }}
      {...props}
    >
      <span className='core-menu-checkbox-indicator absolute left-2 flex size-4 items-center justify-center rounded-control border transition-colors'>
        <Check aria-hidden='true' className='core-menu-checkbox-check absolute size-3' />
        <Minus aria-hidden='true' className='core-menu-checkbox-minus absolute size-3' />
      </span>
      {children}
    </DropdownMenu.CheckboxItem>
  )
)

MenuCheckboxItem.displayName = 'MenuCheckboxItem'

export type MenuRadioItemProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenu.RadioItem
> &
  VariantProps<typeof menuItemVariants> & {
    /** Keep radio menus open by default so preference changes are inspectable. */
    closeOnSelect?: boolean
  }

export const MenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenu.RadioItem>,
  MenuRadioItemProps
>(
  (
    {
      children,
      className,
      closeOnSelect = false,
      onSelect,
      size = 'compact',
      ...props
    },
    ref
  ) => (
    <DropdownMenu.RadioItem
      ref={ref}
      className={cn(menuItemVariants({ size }), 'pl-8', className)}
      data-size={size}
      onSelect={(event) => {
        if (!closeOnSelect) event.preventDefault()
        onSelect?.(event)
      }}
      {...props}
    >
      <span className='core-menu-radio-indicator absolute left-2 flex size-4 items-center justify-center rounded-full border transition-colors'>
        <span className='core-menu-radio-dot size-2 rounded-full' />
      </span>
      {children}
    </DropdownMenu.RadioItem>
  )
)

MenuRadioItem.displayName = 'MenuRadioItem'

export type MenuLabelProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenu.Label
> & {
  inset?: boolean
}

export const MenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenu.Label>,
  MenuLabelProps
>(({ className, inset = false, ...props }, ref) => (
  <DropdownMenu.Label
    ref={ref}
    className={cn('core-menu-label text-xs font-semibold leading-5', inset && 'pl-8', className)}
    {...props}
  />
))

MenuLabel.displayName = 'MenuLabel'

export const MenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenu.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenu.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenu.Separator
    ref={ref}
    className={cn('core-menu-separator h-px', className)}
    {...props}
  />
))

MenuSeparator.displayName = 'MenuSeparator'

export type MenuShortcutProps = React.HTMLAttributes<HTMLSpanElement> & {
  keys?: string[]
}

export const MenuShortcut = ({
  children,
  className,
  keys,
  ...props
}: MenuShortcutProps) => (
  <span className={cn('core-menu-shortcut ml-auto', className)} {...props}>
    {keys?.length
      ? keys.map((key, index) => (
          <kbd className='core-menu-shortcut-key' key={`${key}-${index}`}>
            {key}
          </kbd>
        ))
      : children}
  </span>
)

export type MenuSubTriggerProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenu.SubTrigger
> &
  VariantProps<typeof menuItemVariants>

export const MenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenu.SubTrigger>,
  MenuSubTriggerProps
>(({ children, className, inset = false, size = 'compact', ...props }, ref) => (
  <DropdownMenu.SubTrigger
    ref={ref}
    className={cn(menuItemVariants({ inset, size }), className)}
    data-size={size}
    {...props}
  >
    {children}
    <ChevronRight aria-hidden='true' className='ml-auto size-4' />
  </DropdownMenu.SubTrigger>
))

MenuSubTrigger.displayName = 'MenuSubTrigger'

export type MenuSubContentProps = MenuContentProps

export const MenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenu.SubContent>,
  MenuSubContentProps
>(({ className, size = 'compact', themeMode, ...props }, ref) => {
  const inheritedThemeMode = useCoreThemeMode()
  const resolvedThemeMode = themeMode ?? inheritedThemeMode

  return (
    <DropdownMenu.SubContent
      ref={ref}
      className={cn(menuContentVariants({ size }), className)}
      data-size={size}
      data-theme={resolvedThemeMode === 'dark' ? 'dark' : undefined}
      {...props}
    />
  )
})

MenuSubContent.displayName = 'MenuSubContent'
