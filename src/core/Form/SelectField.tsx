/* eslint-disable @typescript-eslint/no-explicit-any */
import { colors, spacing, typography } from '../theme'

type StyleFn = (base: any, state?: any) => any
type StylesMap = Record<string, StyleFn>

// Shared react-select style map for the primary select look. Consumed by the
// RHF `FormSelectField` adapter and by product code that renders react-select
// directly (async/remote-search selects with no @/core primitive).
export const PrimarySelectFieldStyle: StylesMap = {
  container: base => ({
    ...base,
    marginTop: 5,
    fontSize: typography.sizes.medium,
    fontFamily: typography.faces.default
  }),
  valueContainer: base => ({
    ...base,
    padding: '4px 8px',
    'span:nth-of-type(2)': {
      marginRight: spacing.xxsmall
    }
  }),
  control: (
    base,
    { isFocused, isDisabled, selectProps: { 'aria-invalid': isInvalid } }
  ) => ({
    ...base,
    backgroundColor: isDisabled ? colors.dawn : colors.white,
    border: isInvalid ? `1px solid ${colors.red}` : `1px solid ${colors.frost}`,
    borderRadius: 4,
    boxShadow: 'none',
    cursor: isFocused ? 'default' : 'cursor',
    display: 'flex',
    minHeight: 'unset',
    outline: 'none',
    '&:hover': {
      border: isFocused
        ? `1px solid ${colors.blueLight}`
        : `1px solid ${colors.karlLight2}`
    },
    '&:focus-within': {
      border: `1px solid ${colors.karlLight2}`,
      outline: `1px solid ${colors.blueLight}`
    },
    '> div': {
      cursor: 'pointer'
    }
  }),
  placeholder: base => ({
    ...base,
    color: colors.karl,
    cursor: 'text'
  }),
  input: base => ({
    ...base,
    color: colors.graphite,
    fontSize: typography.sizes.medium
  }),
  singleValue: (base, state) => ({
    ...base,
    color: state.isDisabled ? colors.karlLight1 : colors.graphite,
    fontSize: typography.sizes.medium,
    display: 'flex',
    justifyContent: 'space-between',
    width: '100%'
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused
      ? colors.dawn
      : state.isSelected
        ? colors.frostLight
        : colors.white,
    color: colors.graphite,
    cursor: 'pointer',
    fontSize: typography.sizes.medium,
    fontWeight: state.isSelected
      ? typography.weights.bold
      : typography.weights.normal,
    '&:hover': {
      backgroundColor: colors.dawn
    }
  }),
  multiValue: base => ({
    ...base,
    backgroundColor: colors.frost,
    borderRadius: '3px',
    // Don't show right label for selected multi-value tags
    'span:nth-of-type(2)': {
      display: 'none'
    }
  }),
  multiValueLabel: base => ({
    ...base,
    fontSize: typography.sizes.small
  }),
  multiValueRemove: base => ({
    ...base,
    color: colors.karl,
    ':hover': {
      color: colors.black
    }
  }),
  indicatorsContainer: () => ({
    display: 'flex',
    gap: '8px',
    padding: '0 8px',
    alignItems: 'baseline',
    '> div': {
      display: 'flex',
      padding: '0'
    }
  }),
  dropdownIndicator: (base, { isDisabled }) => ({
    ...base,
    cursor: isDisabled ? 'default' : 'pointer',
    display: isDisabled ? 'none' : ''
  }),
  indicatorSeparator: () => ({
    display: 'none'
  })
}
