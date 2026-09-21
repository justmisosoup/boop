/** @type {import('tailwindcss').Config} */

// This config is part of the shadcn substrate seam. Expect `colors.*`,
// `borderRadius.*`, and animation entries to grow over time as more
// shadcn-derived primitives migrate into `src/core`. New primitives often
// expect utilities that resolve against `--core-*` tokens defined in
// `src/core/theme.css`. See `src/core/internal/ui/README.md` for the
// substrate boundary and how `components.json` ties in.
module.exports = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      /**
       * The width the three-column page needs before it is worth having.
       *
       * 48 of page padding + 224 of contents rail + 24 of gap + 480 of
       * reference panel is 776, so at 1280 the report still gets 504: a
       * readable measure, and the report grows from there toward its preferred
       * 800. Below this the page stacks.
       *
       * It was 1576, which is the width at which the report gets its full 800.
       * That treated a preference as a requirement and sent common laptop
       * widths to the stacked page for no reason. `lg` (1024) is the other
       * error: all three columns fitted and the report crushed to 224.
       */
      screens: {
        /**
         * The panel docks. 48 of page padding + 480 of panel is 528, so the
         * report gets 352 here and grows from there: narrow, but the record
         * beside the report is worth more than the extra measure. Below this
         * the panel goes under the report instead.
         *
         * Both numbers here are budgets over the width the PAGE has, and the
         * page no longer has the window: the global nav rail takes 224 of it
         * when pinned, which is the default. So both carry the rail — 880 + 224.
         * Unpinned the rail only takes 49, and the page gets 175 more than the
         * budget asks for, which costs nothing.
         */
        wide: '1104px',
        /**
         * The contents rail joins it. It costs 224 plus a 24 gap, which the
         * report can only afford once there is 1280 to share: 48 + 224 + 24 +
         * 480 leaves it 504. Plus the nav rail, as above.
         *
         * One breakpoint for both was the error. At 1576 ordinary laptops got
         * the stacked page; at 1280 a 1064px window still lost the panel
         * entirely, when all it could not afford was the rail. The rail is
         * margin furniture, so it is what goes first.
         */
        desk: '1504px'
      },
      fontFamily: {
        suisse: ["'Suisse Intl'", 'sans-serif']
      },
      // Motion scale resolving against `--core-*` tokens in theme.css. Prefer
      // `duration-{fast,standard,slow,slower}` + `ease-{standard,emphasized}`
      // over arbitrary ms so chrome/app animations stay consistent.
      transitionDuration: {
        fast: 'var(--core-duration-fast)',
        standard: 'var(--core-duration-standard)',
        slow: 'var(--core-duration-slow)',
        slower: 'var(--core-duration-slower)'
      },
      transitionTimingFunction: {
        standard: 'var(--core-ease-standard)',
        emphasized: 'var(--core-ease-emphasized)'
      },
      // Layering ladder resolving against `--core-z-*` tokens. Prefer
      // `z-nav|z-floating|z-overlay|z-popover` over arbitrary `z-[…]` so
      // floating surfaces stack predictably against each other.
      zIndex: {
        // A page's own fixed chrome — a record's name bar, say. Under the
        // global nav rather than over it: the rail expands over the page on
        // hover, and a page bar at `z-floating` sliced that overlay in half.
        chrome: 'calc(var(--core-z-nav) - 1)',
        nav: 'var(--core-z-nav)',
        floating: 'var(--core-z-floating)',
        overlay: 'var(--core-z-overlay)',
        popover: 'var(--core-z-popover)'
      },
      // Semantic type roles resolving against `--core-font-size-*` tokens.
      // Use these instead of arbitrary `text-[var()]` values — a bare var()
      // in `text-[...]` is parsed as a *color* and the size is silently
      // dropped (text falls back to the inherited 16px root size).
      fontSize: {
        caption: ['var(--core-font-size-sm)', { lineHeight: '1.25rem' }],
        dense: ['var(--core-font-size-dense)', { lineHeight: '1.25rem' }],
        body: ['var(--core-font-size-md)', { lineHeight: '1.5rem' }],
        'body-lg': ['var(--core-font-size-lg)', { lineHeight: '1.75rem' }]
      },
      // Elevation roles. Use `shadow-elevation-*` instead of arbitrary
      // `shadow-[var()]` — a bare var() is parsed as a shadow *color* and
      // the box-shadow is silently dropped.
      boxShadow: {
        'elevation-card': 'var(--core-color-elevation-card)',
        'elevation-control': 'var(--core-color-elevation-control)',
        'elevation-raised': 'var(--core-color-elevation-raised)',
        'elevation-popover': 'var(--core-color-elevation-popover)',
        'elevation-modal': 'var(--core-color-elevation-modal)',
        'elevation-drawer': 'var(--core-color-elevation-drawer)'
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xxs: 'var(--core-radius-xxs)',
        control: 'var(--core-radius-control)',
        card: 'var(--core-radius-card)',
        popover: 'var(--core-radius-popover)',
        modal: 'var(--core-radius-modal)',
        drawer: 'var(--core-radius-drawer)',
        pill: 'var(--core-radius-pill)'
      },
      colors: {
        // Legacy palette keys REMOVED in this prototype (dawn, frost, graphite,
        // karl, link, midnight, yellow and their variants). They are the old
        // design system; nothing here may reach for them. Only the scoped core
        // semantic roles below are available.

        // Scoped core semantic roles. These resolve only inside .core-theme.
        background: 'var(--core-color-surface-canvas)',
        foreground: 'var(--core-color-text-primary)',
        card: {
          DEFAULT: 'var(--core-color-surface-card)',
          foreground: 'var(--core-color-text-primary)'
        },
        popover: {
          DEFAULT: 'var(--core-color-surface-popover)',
          foreground: 'var(--core-color-text-primary)'
        },
        primary: {
          DEFAULT: 'var(--core-color-action-primary-bg)',
          foreground: 'var(--core-color-action-primary-fg)'
        },
        secondary: {
          DEFAULT: 'var(--core-color-action-secondary-bg)',
          foreground: 'var(--core-color-action-secondary-fg)'
        },
        muted: {
          DEFAULT: 'var(--core-color-surface-subtle)',
          foreground: 'var(--core-color-text-muted)'
        },
        accent: {
          DEFAULT: 'var(--core-color-surface-subtle)',
          foreground: 'var(--core-color-text-primary)'
        },
        destructive: {
          DEFAULT: 'var(--core-color-action-destructive-bg)',
          foreground: 'var(--core-color-action-destructive-fg)'
        },
        border: 'var(--core-color-border-default)',
        input: 'var(--core-color-control-border)',
        ring: 'var(--core-color-focus-ring)',
        surface: {
          canvas: 'var(--core-color-surface-canvas)',
          default: 'var(--core-color-surface-default)',
          card: 'var(--core-color-surface-card)',
          raised: 'var(--core-color-surface-raised)',
          subtle: 'var(--core-color-surface-subtle)',
          inset: 'var(--core-color-surface-inset)',
          inverse: 'var(--core-color-surface-inverse)'
        },
        text: {
          primary: 'var(--core-color-text-primary)',
          secondary: 'var(--core-color-text-secondary)',
          muted: 'var(--core-color-text-muted)',
          disabled: 'var(--core-color-text-disabled)',
          inverse: 'var(--core-color-text-inverse)',
          link: 'var(--core-color-text-link)'
        },
        brand: {
          accent: 'var(--core-color-brand-accent)',
          'on-accent': 'var(--core-color-brand-on-accent)'
        }
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' }
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' }
        },
        'popover-in': {
          '0%': { opacity: '0', transform: 'translate3d(0, 6px, 0)' },
          '100%': { opacity: '1', transform: 'translate3d(0, 0, 0)' }
        },
        'popover-out': {
          '0%': { opacity: '1', transform: 'translate3d(0, 0, 0)' },
          '100%': { opacity: '0', transform: 'translate3d(0, 6px, 0)' }
        },
        // Indeterminate progress bar: a short segment that slides across the
        // track. Used by DataTable's refetch indicator.
        indeterminate: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 3.5s linear infinite',
        'fade-in': 'fade-in 0.35s ease-out both',
        'fade-out': 'fade-out 0.18s ease-out both',
        'popover-in': 'popover-in 0.16s cubic-bezier(0.16, 1, 0.3, 1) both',
        'popover-out': 'popover-out 0.16s cubic-bezier(0.16, 1, 0.3, 1) both',
        indeterminate: 'indeterminate 1.1s ease-in-out infinite'
      }
    }
  },
  plugins: [
    require('tailwindcss-animate'),
    // Hide scrollbars while keeping scrollability. Used by the AppShell nav
    // rail (and available app-wide) so the chrome keeps clean edges, matching
    // the legacy SideNavBar's hidden-scrollbar treatment.
    require('tailwindcss/plugin')(({ addUtilities }) => {
      addUtilities({
        '.scrollbar-none': {
          'scrollbar-width': 'none',
          '-ms-overflow-style': 'none'
        },
        '.scrollbar-none::-webkit-scrollbar': { display: 'none' }
      })
    })
  ]
}
