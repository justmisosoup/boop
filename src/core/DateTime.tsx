import type React from 'react'

import dayjs, { type ConfigType } from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import relativeTime from 'dayjs/plugin/relativeTime'
import styled from 'styled-components'

dayjs.extend(relativeTime)
dayjs.extend(localizedFormat)

const Time = styled.time``

type DateTimeProps = Omit<
  React.TimeHTMLAttributes<HTMLTimeElement>,
  'children'
> & {
  children?: ConfigType
  formatter?: (datetime: string) => string
  relative?: boolean
}

const DateTime = ({
  children,
  formatter = datetime => datetime,
  relative = false,
  ...props
}: DateTimeProps) => {
  if (!children) {
    return <time />
  }

  const time = dayjs(children)
  const lastWeek = dayjs().subtract(1, 'w')
  let formatted =
    relative || lastWeek < time ? time.fromNow() : time.format('LL')

  if (formatter) {
    formatted = formatter(formatted)
  }

  return (
    <Time dateTime={time.toISOString()} title={time.format('LLL Z')} {...props}>
      {formatted}
    </Time>
  )
}

export default DateTime
