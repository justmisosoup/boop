import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

/**
 * The app's preconfigured singleton, cut down to what is used here.
 *
 * Ported from `app/src/lib/dayjs.ts`, which registers more plugins than this
 * prototype needs — `customParseFormat` is the one the timeline depends on
 * (`dayjs(day, 'YYYY-MM-DD')` for a date-only filing). Add plugins here rather
 * than importing `dayjs` directly, so there is one configured instance.
 */
dayjs.extend(customParseFormat)

export default dayjs
