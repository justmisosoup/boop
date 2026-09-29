import type { ReactElement } from 'react'

import { ReactComponent as BBB } from './profileIcons/bbb.svg'
import { ReactComponent as Facebook } from './profileIcons/facebook-primary-icon.svg'
import { ReactComponent as Google } from './profileIcons/google-icon.svg'
import { ReactComponent as Instagram } from './profileIcons/instagram-icon.svg'
import { ReactComponent as LinkedIn } from './profileIcons/linked-in-icon.svg'
import { ReactComponent as TikTok } from './profileIcons/tiktok.svg'
import { ReactComponent as Trustpilot } from './profileIcons/trustpilot.svg'
import { ReactComponent as X } from './profileIcons/twitter-x.svg'
import { ReactComponent as Yelp } from './profileIcons/yelp-icon.svg'

/**
 * A third-party profile's mark, as the dashboard draws it
 * (`app/src/constants/profileIcons.tsx`, the SVGs copied from
 * `app/src/components/Icons`). Instagram's viewBox is the app's own crop.
 */
const ICONS: Record<string, (size: number) => ReactElement> = {
  facebook: (s) => <Facebook width={s} height={s} />,
  google: (s) => <Google width={s} height={s} />,
  linkedin: (s) => <LinkedIn width={s} height={s} />,
  yelp: (s) => <Yelp width={s} height={s} />,
  trustpilot: (s) => <Trustpilot width={s} height={s} />,
  bbb: (s) => <BBB width={s} height={s} />,
  x: (s) => <X width={s} height={s} />,
  tiktok: (s) => <TikTok width={s} height={s} />,
  instagram: (s) => <Instagram viewBox="3 3 42 42" width={s} height={s} />
}

export const ProfileIcon = ({ type, size = 14 }: { type: string; size?: number }) => {
  const icon = ICONS[type.toLowerCase()]
  return icon ? (
    <span aria-hidden="true" className="inline-flex shrink-0">
      {icon(size)}
    </span>
  ) : null
}
