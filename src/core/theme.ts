const baseColors = {
  silas: '#56726F',
  midnight: '#6D8388',
  red: '#CD2523',
  orange: '#C4440E',
  yellow: '#FAE530',
  green: '#097F3D',
  blue: '#0637FF',

  // monochrome
  karl: '#5F6874',
  frost: '#D9E0E8',
  dawn: '#ECF0F4',
  white: '#FFFFFF',
  graphite: '#333333',
  black: '#000000',

  // legacy
  indigo: '#4263EB',
  purple: '#8732DE',
  magenta: '#EC327C',

  // accent
  greenAccent: '#A8FF1C',

  //funky
  lavender: '#8732DE',
  pink: '#D10069'
}

const saturatedColors = {
  redLight: '#FCE6E6',
  orangeLight: '#FCF1E4',
  yellowLight: '#FFF9C7',
  greenLight: '#E2F7E6',
  blueLight: '#DDE4FF',
  karlLight1: '#77818F',
  karlLight2: '#BDC2C9',
  frostLight: '#F9FAFB',
  silasLight1: '#AAB8B7',
  silasLight2: '#C9E4E4',
  silasDark1: '#425D5D',
  silasDark2: '#385656',
  silasDark3: '#364F4F',
  silasDark4: '#243636',
  midnightLight2: '#CED6D7',
  midnightLight1: '#9DADB0',
  midnightDark1: '#3C5A61',
  midnightDark2: '#0B3139',
  blueDark: '#112C9D',

  //funky
  lavenderLight: '#ECD9FF',
  pinkLight: '#FFE8F1'
}

export const colors = {
  ...baseColors,
  ...saturatedColors
}

export const devices = {
  mobile: '480px',
  tablet: '1024px'
}

export const spacing = {
  xxsmall: '4px',
  xsmall: '8px',
  small: '12px',
  medium: '16px',
  large: '20px',
  xlarge: '24px',
  xxlarge: '40px',

  // Legacy - will be deprecated
  compact: '10px',
  normal: '20px'
}

export const borderRadius = {
  xxsmall: '2px',
  xsmall: '4px',
  small: '10px',
  medium: '24px',
  large: '34px'
}

export const typography = {
  faces: {
    display: 'Suisse Intl',
    default: 'Suisse Intl'
  },

  sizes: {
    xsmall: '0.625rem',
    small: '0.75rem',
    medium: '0.875rem',
    large: '1rem',
    xlarge: '1.75rem',

    display: {
      small: '1.25rem',
      medium: '1.5rem',
      large: '1.875rem',
      xlarge: '3.125rem'
    }
  },

  weights: {
    light: 300,
    normal: 400,
    bold: 600
  }
}

//  Button styles
export const primary = Object.freeze({
  backgroundColor: colors.midnightDark1,
  borderColor: colors.midnightDark1,
  color: colors.white,
  active: {
    backgroundColor: colors.midnightDark2,
    borderColor: colors.midnightDark2
  },
  hover: {
    backgroundColor: colors.midnight,
    borderColor: colors.midnight
  },
  focus: {
    borderColor: colors.blueLight,
    outlineColor: colors.midnightDark1
  },
  disabled: {
    backgroundColor: colors.midnightLight1,
    borderColor: colors.midnightLight1,
    color: colors.white
  }
})

export const secondary = Object.freeze({
  backgroundColor: colors.white,
  borderColor: colors.frost,
  color: colors.graphite,
  active: {
    backgroundColor: colors.dawn,
    borderColor: colors.karlLight2
  },
  hover: {
    backgroundColor: colors.white,
    borderColor: colors.karlLight2
  },
  focus: {
    borderColor: colors.karlLight2,
    outlineColor: colors.midnightDark1
  },
  disabled: {
    backgroundColor: colors.dawn,
    borderColor: colors.karlLight2,
    color: colors.karlLight2
  }
})

export const transparent = Object.freeze({
  backgroundColor: colors.white,
  borderColor: colors.white,
  color: colors.graphite,
  active: {
    backgroundColor: colors.white,
    borderColor: colors.white
  },
  hover: {
    backgroundColor: colors.white,
    borderColor: colors.karlLight2
  },
  focus: {
    borderColor: colors.white,
    outlineColor: colors.midnightDark1
  },
  disabled: {
    backgroundColor: colors.white,
    borderColor: colors.white,
    color: colors.karlLight2
  }
})

// ── Semantic tokens (scoped theming) ────────────────────────────────
export {
  semanticColors,
  semanticColorTokens,
  tokenVar,
  semanticSpacing,
  semanticTypography,
  semanticRadius
} from './tokens'

export type {
  SemanticColorToken,
  SemanticSpacingToken,
  SemanticTypographyToken,
  SemanticRadiusToken
} from './tokens'
