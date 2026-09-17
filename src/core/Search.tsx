import type React from 'react'
import { useEffect, useState, useRef } from 'react'

import searchQuery, {
  type ISearchParserDictionary,
  SearchParserResult
} from 'search-query-parser'
import styled, { css } from 'styled-components'

import { Icon } from './Icon'
import Loader from './Loader'
import { colors } from './theme'

const Box = styled.div`
  position: relative;

  > input[disabled] + svg + svg {
    display: none;
  }
`

const Input = styled.input`
  appearance: none;
  border: 1px solid ${colors.frost};
  border-radius: 35px;
  font-size: 14px;
  height: 35px;
  outline: none;
  padding: 0 20px 0 34px;
  transition:
    border-color 150ms ease,
    background-color 150ms ease,
    box-shadow 150ms ease;
  width: 100%;

  &::placeholder {
    color: ${colors.karl};
    line-height: normal;
  }

  &::-webkit-search-decoration {
    appearance: none;
  }

  &::-webkit-search-cancel-button {
    display: none;
  }

  &:not([disabled]) {
    background-color: ${colors.white};

    &:hover {
      border-color: ${colors.karlLight2};
    }

    &:focus {
      border-color: ${colors.blueLight};
      border-width: 2px;
      box-shadow: 0 0 1px ${colors.blueLight};
    }
  }

  &[disabled] {
    background-color: ${colors.dawn};
  }
`

const iconStyles = css`
  color: ${colors.karl};
  cursor: pointer;
  padding: 0 7px 0 8px;
  position: absolute;
  top: 50%;
`

const SearchIconStyle = styled.div`
  ${iconStyles}
  margin-top: -10.5px;
`

const CloseIconStyle = styled.div`
  ${iconStyles}
  color: ${colors.karl};
  margin-top: -8px;
  right: 4px;
  top: 50%;
  transition: fill 250ms ease;

  &:hover,
  &:focus {
    color: ${colors.graphite};
  }
`

const Spinner = styled(Loader).attrs({ size: 'small' as const })`
  margin-top: -8px;
  position: absolute;
  right: 13px;
  top: 50%;
`

type SearchTerms = ISearchParserDictionary & {
  text?: string
}

type SearchProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'onKeyDown' | 'placeholder'
> & {
  terms?: SearchTerms | null
  keywords?: string[] | null
  loading?: boolean
  placeholder?: string
  onClear?: (() => void) | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSearch?: (params: any) => void | Promise<void>
}

const Search = ({
  terms = {},
  placeholder = 'Search',
  keywords: _keywords = [],
  loading: _loading = false,
  onClear,
  onSearch = () => {},
  ...props
}: SearchProps) => {
  const ref = useRef<HTMLInputElement>(null)

  const [value, setValue] = useState<string | null>(null)
  const [loading, setLoading] = useState(_loading)
  const [keywords] = useState<string[]>(_keywords ?? [])

  async function search(query: string) {
    const result = searchQuery.parse(query, { keywords })
    const params = typeof result === 'string' ? { text: result } : result

    setLoading(true)

    await onSearch(params)

    setLoading(false)
  }

  const onClose = () => {
    if (ref.current) {
      ref.current.value = ''
    }
    setValue(null)

    onClear?.()
  }

  const onFocus = () => {
    ref.current?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.keyCode === 13) {
      search((e.target as HTMLInputElement).value)
    }
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValue(e.target.value)

  useEffect(() => setLoading(_loading), [_loading])

  useEffect(() => {
    if (!ref.current) return

    if (!terms) {
      ref.current.value = ''

      setValue('')

      return
    }

    const tokens: string[] = []

    if (terms.text) {
      tokens.push(terms.text as string)
    }

    keywords.forEach(keyword => {
      if (terms[keyword]) {
        tokens.push(`${keyword}:"${terms[keyword]}"`)
      }
    })

    ref.current.value = tokens.join(' ')
    setValue(ref.current.value)
  }, [keywords, terms])

  return (
    <Box>
      <Input
        ref={ref}
        type='search'
        placeholder={placeholder}
        spellCheck='false'
        onChange={onChange}
        onKeyDown={onKeyDown}
        {...props}
      />
      <SearchIconStyle onClick={onFocus}>
        <Icon name='magnifyingGlass' size={20} />
      </SearchIconStyle>
      {loading ? (
        <Spinner size='small' />
      ) : (
        <CloseIconStyle
          style={{ display: value ? 'inline-block' : 'none' }}
          onClick={onClose}
        >
          <Icon name='cross2' />
        </CloseIconStyle>
      )}
    </Box>
  )
}

export default Search
