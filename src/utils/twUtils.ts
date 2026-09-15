import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * Teach tailwind-merge the semantic theme keys from tailwind.config.js so
 * they merge in the correct conflict groups: `text-body` is a font size
 * (not a text color), `shadow-elevation-*` is a box-shadow (not a shadow
 * color). Without this, `cn('text-foreground', 'text-body')` would treat
 * both as colors and drop one.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['caption', 'dense', 'body', 'body-lg'] }],
      z: [{ z: ['nav', 'floating', 'overlay', 'popover'] }],
      shadow: [
        {
          shadow: [
            'elevation-card',
            'elevation-raised',
            'elevation-popover',
            'elevation-modal',
            'elevation-drawer'
          ]
        }
      ]
    }
  }
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
