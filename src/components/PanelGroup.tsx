import type { ReactNode } from 'react'

import { CardLabel } from './CardLabel'

/**
 * A named run of rows in a tab.
 *
 * Just a name over its rows. It used to be a disclosure — a chevron, a count,
 * and the whole line as the hit target — from when these lists lived in a 392px
 * column beside the report and were several screens of scroll with no structure
 * to skip by. They are the page now, and the cards under each name say how much
 * is in them by being there, so the control was asking the reader to manage a
 * problem they no longer have. The count went with it: a number beside a group
 * you can see in full is the same fact said twice.
 *
 * The `id` stays. It is the scroll target a citation jumps to, and that is the
 * one thing the heading was ever doing for anyone outside this component.
 */
export const PanelGroup = ({
  id,
  label,
  children
}: {
  /** The scroll target, so a citation can jump to a group. */
  id?: string
  /**
   * A name over the group, for a group of several cards (the Sources tab's
   * bands). A group that is one card names itself on the card — `CardHeader`
   * — and passes nothing here.
   */
  label?: string
  children: ReactNode
}) => (
  <section id={id} className="scroll-mt-6">
    {label && (
      <CardLabel as="h4" className="mb-2 font-semibold">
        {label}
      </CardLabel>
    )}
    {children}
  </section>
)
