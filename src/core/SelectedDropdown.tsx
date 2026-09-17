import type React from 'react'

import isString from 'lodash/isString'
import RSelect, {
  components,
  type ControlProps,
  createFilter,
  type OptionProps,
  type Theme
} from 'react-select'
import styled from 'styled-components'

import { Icon } from './Icon'
import Search from './Icons/Search'
import { colors, typography } from './theme'

type SelectedDropdownOption = {
  value: string
  label: React.ReactNode
  alternativeFilterMatches?: string[]
}

// react-select v5 ships strict generic types, but the loose props this
// component accepts can't be retyped without a behavior-changing refactor:
//   - `value` accepts a bare string that we coerce to `{ label }` (no `value`
//     field), which violates `SelectedDropdownOption`
//   - `selectRef` is `React.Ref<unknown>`, not `Ref<Select<...>>`
//   - the `[key: string]: unknown` index signature on SelectedDropdownProps
//     allows arbitrary forwarded props that don't satisfy `Props<...>`
// Erasing the Select generics keeps this an upgrade rather than a rewrite;
// the inline `components={{...}}` object literal below is still checked
// individually against IconOption/SelectControl's typed prop signatures.
const Select = RSelect as unknown as React.ComponentType<
  Record<string, unknown>
>

type StyleArg = Record<string, unknown>

const customTheme = (provided: Theme): Theme => ({
  ...provided,
  borderRadius: 4,
  spacing: {
    ...provided.spacing,
    controlHeight: 22
  }
})

const styles = (fitToContent: boolean) => ({
  container: (provided: StyleArg) => ({
    ...provided,
    minWidth: fitToContent ? '0px' : '300px',
    fontSize: '14px',
    fontFamily: 'Suiss Intl',
    display: 'flex',
    width: '100%',
    border: `1px solid ${colors.frost}`,
    backgroundColor: `${colors.white}`,
    borderRadius: '4px',
    '&:hover': {
      border: `1px solid ${colors.karlLight2}`
    }
  }),
  valueContainer: (provided: StyleArg) => ({
    ...provided,
    padding: '0 4px',
    width: '100%'
  }),
  control: (provided: StyleArg, { isFocused }: { isFocused: boolean }) => ({
    ...provided,
    fontFamily: typography.faces.default,
    width: '100%',
    height: isFocused ? '34px' : '22px',
    alignContent: 'center',
    border: 'transparent',
    boxShadow: isFocused
      ? `0 0 0 2px ${colors.blueLight} inset`
      : '0 0 0 2px transparent inset',
    margin: 6,
    borderRadius: '34px',
    cursor: 'pointer',
    paddingLeft: isFocused && '12px',
    paddingRight: isFocused && '2px'
  }),
  singleValue: (provided: StyleArg) => ({
    ...provided,
    transform: 'none',
    position: 'relative'
  }),
  indicatorSeparator: (provided: StyleArg) => ({
    ...provided,
    display: 'none'
  }),
  menu: (provided: StyleArg) => ({
    ...provided,
    border: `1px solid ${colors.frost}`,
    borderRadius: '0 0 4px 4px',
    boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.1)',
    fontSize: '0.875rem',
    left: 0,
    top: 38,
    width: '100%',
    fontFamily: `${typography.faces.default}`
  }),
  option: (provided: StyleArg, { isFocused }: { isFocused: boolean }) => ({
    ...provided,
    backgroundColor: isFocused ? colors.dawn : colors.white,
    borderLeft: isFocused
      ? `2px solid ${colors.midnight}`
      : '2px solid transparent',
    color: colors.graphite,
    cursor: 'pointer'
  }),
  placeholder: (provided: StyleArg) => ({
    ...provided,
    color: colors.karl
  })
})

const StyledLabel = styled.div<{ value?: string }>`
  align-items: center;
  display: flex;
  flex-direction: row;
  font-family: ${typography.faces.default};

  ${({ value }) => value === 'back' && 'font-weight: 600;'}
  svg {
    stroke: var(--oc-gray-9);

    path {
      width: 2px;
    }
  }
`

const SearchIcon = styled(Search)`
  height: 14px;
  stroke: ${colors.karl};
  width: 14px;
`

const SelectControl = (props: ControlProps<SelectedDropdownOption, false>) => {
  return (
    <components.Control {...props}>
      {props.isFocused && <SearchIcon />}
      {props.children}
    </components.Control>
  )
}

const IconOption = (props: OptionProps<SelectedDropdownOption, false>) => {
  return (
    <components.Option {...props}>
      <StyledLabel value={props.data.value}>
        {props.data.value === 'back' && <Icon name='caretLeft' />}
        {props.data.label}
      </StyledLabel>
    </components.Option>
  )
}

type SelectedDropdownProps = {
  value?: string | SelectedDropdownOption | null
  options?: SelectedDropdownOption[]
  placeholder?: React.ReactNode
  ariaLabel?: React.ReactNode
  selectRef?: React.Ref<unknown>
  fitToContent?: boolean
  defaultMenuIsOpen?: boolean
  focusIndicator?: React.ComponentType<unknown>
  [key: string]: unknown
}

const SelectedDropdown = ({
  value,
  options,
  placeholder,
  ariaLabel,
  selectRef,
  fitToContent = false,
  defaultMenuIsOpen = false,
  focusIndicator,
  ...props
}: SelectedDropdownProps) => {
  const filterOptions = {
    ignoreCase: true,
    ignoreAccents: true,
    matchFrom: 'any' as const,
    stringify: (option: {
      data: SelectedDropdownOption
      value: string
      label: React.ReactNode
    }) => {
      let stringified

      const label = option.data.label as
        | { props?: Record<string, unknown> }
        | string

      if (typeof label === 'object' && label?.props) {
        const joinLabels = Object.values(label.props).join(' ')

        stringified = `${option.value} ${joinLabels}`
      } else {
        stringified = `${option.value} ${option.label}`
      }

      // Add any alternative options we should be able to filter on
      // ex. 'Secretary of State' for a label including 'SOS'
      if (option.data.alternativeFilterMatches) {
        return stringified.concat(
          option.data.alternativeFilterMatches.join(' ')
        )
      } else {
        return stringified
      }
    },
    trim: true
  }

  return (
    <Select
      className={'react-select-container'}
      classNamePrefix={'react-select'}
      theme={customTheme}
      styles={styles(fitToContent)}
      value={isString(value) ? { label: value } : value}
      options={options}
      components={{
        Option: IconOption,
        Control: SelectControl,
        ...(focusIndicator && { DropdownIndicator: focusIndicator })
      }}
      filterOption={createFilter(filterOptions)}
      ref={selectRef}
      aria-label={ariaLabel}
      placeholder={placeholder}
      defaultMenuIsOpen={defaultMenuIsOpen}
      {...props}
    />
  )
}

export default SelectedDropdown
