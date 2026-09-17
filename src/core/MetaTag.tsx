import type React from 'react'

import { Link, type To } from 'react-router'
import styled from 'styled-components'

import { colors, typography } from './theme'

type Swatch = {
  color: string
  backgroundColor: string
  borderColor?: string
}

const swatches: Record<string, Swatch> = Object.freeze({
  primary: {
    color: colors.green,
    backgroundColor: colors.greenLight
  },
  secondary: {
    color: colors.blue,
    backgroundColor: colors.blueLight
  },
  submitted: {
    color: colors.white,
    backgroundColor: colors.green,
    borderColor: colors.green
  },
  info: {
    color: colors.karl,
    backgroundColor: colors.white,
    borderColor: colors.frost
  },
  unknown: {
    color: colors.karl,
    backgroundColor: colors.dawn
  },
  warning: {
    color: colors.red,
    backgroundColor: colors.redLight
  },
  active: {
    color: colors.green,
    backgroundColor: colors.greenLight
  },
  inactive: {
    color: colors.orange,
    backgroundColor: colors.orangeLight
  },
  pending: {
    color: colors.orange,
    backgroundColor: colors.orangeLight
  },
  completed: {
    color: colors.blue,
    backgroundColor: colors.blueLight
  },
  green: {
    color: colors.green,
    backgroundColor: colors.greenLight
  },
  yellow: {
    color: colors.karl,
    backgroundColor: colors.yellowLight
  },
  silas: {
    color: colors.midnightDark2,
    backgroundColor: colors.midnightLight2
  },
  midnight: {
    color: colors.midnightDark2,
    backgroundColor: colors.midnightLight2
  },
  lavender: {
    color: colors.lavender,
    backgroundColor: colors.lavenderLight
  },
  pink: {
    color: colors.pink,
    backgroundColor: colors.pinkLight
  }
})

const styles = `
  border-radius: 24px;
  border: 1px solid transparent;
  display: inline-block;
  font-size: ${typography.sizes.small};
  font-weight: ${typography.weights.bold};
  height: min-content;
  line-height: 1;
  padding: 5px 18px;
`

type TagStyleProps = {
  href?: To
  to?: To
  type: string
  onClick?: React.MouseEventHandler
}

const more = ({ href, to, type, onClick }: TagStyleProps) => {
  const { backgroundColor, borderColor, color } = swatches[type]

  const hoverBorderColor = type === 'submitted' ? backgroundColor : color

  return `
    border: 1px solid ${borderColor || backgroundColor};
    background-color: ${backgroundColor};
    color: ${color};

    ${
      onClick || href || to
        ? `
        cursor: pointer;

        &:hover {
          border: 1px solid ${hoverBorderColor};
        }`
        : ''
    }

    & + span,
    & + a {
      margin-left: 5px;
    }
  `
}

const Tag = styled.span<TagStyleProps>`
  ${styles}
  ${more}
`

const LinkTag = styled(Link)<TagStyleProps>`
  ${styles}
  ${more}
`

const getTagType = (type: string | undefined): string =>
  type && type in swatches ? type : 'info'

type MetaTagProps = {
  children?: React.ReactNode
  /** Used when the meta tag should link */
  href?: To
  /** Used when the meta tag should perform an action */
  onClick?: React.MouseEventHandler
  /** Type dictates the theme for the meta tag. Unknown values fall back to `info`. */
  type?: string
}

const MetaTag = ({ children, href = '', type, onClick }: MetaTagProps) => {
  const tagType = getTagType(type)

  return href ? (
    <LinkTag type={tagType} to={href}>
      {children}
    </LinkTag>
  ) : (
    <Tag type={tagType} onClick={onClick}>
      {children}
    </Tag>
  )
}

export const MetaTags = styled.div`
  display: flex;
  flex-wrap: wrap;

  > a,
  > span {
    margin: 5px 0;
  }

  > span:not(:last-child),
  > a:not(:last-child) {
    margin-right: 10px;
  }
`

export default MetaTag
