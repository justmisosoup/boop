import styled from 'styled-components'

import { spacing } from '../theme'

const Filters = styled.td`
  > div > input {
    min-width: 300px;
  }

  > * {
    margin-right: ${spacing.xsmall};
  }
`

export default Filters
