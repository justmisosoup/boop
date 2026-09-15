/**
 * Street View frames for the addresses on a record.
 *
 * A filing states an address; it does not show you the place. The frame is the
 * only source here that answers "what is actually there" — a tower lobby, a
 * strip mall, somebody's driveway — which is the question a registered-agent
 * address or a suspiciously quiet headquarters actually raises.
 *
 * Google is its own source, not a view the registry supplied. It hangs beside
 * the SOS and USPS chips rather than under them, or the frame would read as
 * evidence the registry had taken.
 *
 * Fixtures, in a prototype. In the product these come back from the address
 * sub-agents, which capture the pano at verification time and keep the frames
 * on the address record.
 */

export type AddressStreetView = {
  /** Absent where Google holds no pano for the point — a real answer, kept as
   *  one, rather than an address that silently loses its Google chip. */
  src?: string
  alt: string
  /** The month Google's car drove it. Distinct from `capturedAt`: the imagery
   *  can be a decade older than our reading of it, and on an address that is
   *  the whole point. */
  imageryDate?: string
  /** The pano itself, so "View site" lands exactly where the frame came from. */
  url: string
  /** When we pulled the frame. */
  capturedAt: string
}

/**
 * Unit designators dropped, ZIP+4 cut to five.
 *
 * Street View is of a BUILDING. "85 2nd St" and "85 2nd St Ste 710" are one
 * doorway and share one frame, and a filing writing 94105-3465 where another
 * writes 94105-3459 is the same doorway again.
 */
const key = (address: string): string =>
  address
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .replace(/\b(?:ste|suite|unit|apt|fl|floor|rm|room)\s+[\w-]+/g, ' ')
    .replace(/\b(\d{5})-\d{4}\b/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

const CAPTURED_AT = '2026-09-14'

const FRAMES: Array<Omit<AddressStreetView, 'capturedAt'> & { address: string }> = [
  {
    address: '85 2nd St, San Francisco, CA 94105',
    src: '/streetview/85-2nd-st-sf.jpg',
    alt: 'Street View of 85 2nd St, San Francisco — the lobby entrance under a 85 SECOND plaque',
    imageryDate: 'Jan 2025',
    url: 'https://www.google.com/maps/@37.7882899,-122.4001134,3a,75y,75.57h,90t/data=!3m7!1e1!3m5!1sbxE5P-f4w1wkO6hsnrPNMQ!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D0%26panoid%3DbxE5P-f4w1wkO6hsnrPNMQ%26yaw%3D75.57049!7i16384!8i8192?hl=en'
  },
  {
    address: '56 Broad St, Boston, MA 02109',
    src: '/streetview/56-broad-st-boston.jpg',
    alt: 'Street View of 56 Broad St, Boston',
    imageryDate: 'Aug 2024',
    url: 'https://www.google.com/maps/@42.3578365,-71.0537462,3a,75y,23.69h,90t/data=!3m7!1e1!3m5!1saaT_d5GpiDOk30rtUbNApQ!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D0%26panoid%3DaaT_d5GpiDOk30rtUbNApQ%26yaw%3D23.691708!7i16384!8i8192?hl=en'
  },
  {
    address: '10020 W Fairview Ave, Boise, ID 83704',
    src: '/streetview/10020-w-fairview-ave-boise.jpg',
    alt: 'Street View of 10020 W Fairview Ave, Boise',
    imageryDate: 'Jul 2023',
    url: 'https://www.google.com/maps/@43.6198543,-116.3069375,3a,75y,4.72h,90t/data=!3m7!1e1!3m5!1sAIVFISTY1XEvxfWr-khujw!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D0%26panoid%3DAIVFISTY1XEvxfWr-khujw%26yaw%3D4.7245073!7i16384!8i8192?hl=en'
  },
  {
    address: '14 Scenic Dr, Dayton, NJ 08810',
    src: '/streetview/14-scenic-dr-dayton-nj.jpg',
    alt: 'Street View of 14 Scenic Dr, Dayton NJ — a two-car suburban house',
    imageryDate: 'Jul 2023',
    url: 'https://www.google.com/maps/@40.3845326,-74.5113228,3a,75y,143.18h,90t/data=!3m7!1e1!3m5!1si8_SfVQS7aX-zHrPgOlePw!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D0%26panoid%3Di8_SfVQS7aX-zHrPgOlePw%26yaw%3D143.1813!7i16384!8i8192?hl=en'
  },
  {
    address: '1818 11th St, Sacramento, CA 95811',
    src: '/streetview/1818-11th-st-sacramento.jpg',
    alt: 'Street View of 1818 11th St, Sacramento',
    imageryDate: 'Jan 2025',
    url: 'https://www.google.com/maps/@38.570517,-121.4962196,3a,75y,284.86h,90t/data=!3m7!1e1!3m5!1sdOmdLlCdgElFgP2aYuX4pA!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D0%26panoid%3DdOmdLlCdgElFgP2aYuX4pA%26yaw%3D284.85788!7i16384!8i8192?hl=en'
  },
  {
    address: '2101 Bryant St, San Francisco, CA 94110',
    src: '/streetview/2101-bryant-st-sf.jpg',
    alt: 'Street View of 2101 Bryant St, San Francisco',
    imageryDate: 'Feb 2015',
    url: 'https://www.google.com/maps/@37.7600691,-122.4099639,3a,75y,49.11h,90t/data=!3m7!1e1!3m5!1sPKBrMuPsa145QC72lQHHlA!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D0%26panoid%3DPKBrMuPsa145QC72lQHHlA%26yaw%3D49.110394!7i13312!8i6656?hl=en'
  },
  {
    address: '524 S 2nd St, Springfield, IL 62701',
    src: '/streetview/524-s-2nd-st-springfield-il.jpg',
    alt: 'Street View of 524 S 2nd St, Springfield IL — Lincoln Tower Plaza',
    imageryDate: 'Jun 2023',
    url: 'https://www.google.com/maps/place/Lincoln+Tower+Plaza,+524+S+2nd+St,+Springfield,+IL+62701/@39.7966568,-89.65349,3a,75y,110.61h,90t/data=!3m7!1e1!3m5!1sQVu4qASUExdrqctmM6RyTA!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D0%26panoid%3DQVu4qASUExdrqctmM6RyTA%26yaw%3D110.607!7i16384!8i8192!4m7!3m6!1s0x887539c7e588a25d:0xd4f851ff371a4d24!8m2!3d39.7964838!4d-89.6528515!10e5!16s%2Fg%2F12hl4kwsr?hl=en'
  },
  {
    // Google drives the road but holds no pano at the point itself. Said
    // plainly: an agent looked and there was nothing to see, which is not the
    // same as nobody having looked.
    address: '2035 Sunset Lake Rd, Newark, DE 19702',
    alt: 'No Street View imagery for 2035 Sunset Lake Rd, Newark DE',
    url: 'https://www.google.com/maps/place/2035+Sunset+Lake+Rd,+Newark,+DE+19702/@39.6381629,-75.7304116,17z/data=!3m1!4b1!4m6!3m5!1s0x89c7a9cf597c70bf:0x2e700a536948ba3c!8m2!3d39.6381629!4d-75.7304116!16s%2Fg%2F11c4w3pzx1?hl=en'
  }
]

const BY_ADDRESS = new Map(
  FRAMES.map(({ address, ...frame }) => [
    key(address),
    { ...frame, capturedAt: CAPTURED_AT } as AddressStreetView
  ])
)

/** The frame for an address as a row states it, or nothing. */
export const streetViewFor = (address: string): AddressStreetView | undefined =>
  BY_ADDRESS.get(key(address))
