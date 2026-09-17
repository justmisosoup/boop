import styled from 'styled-components'

import { typography, spacing } from '../theme'

const Controls = styled.td`
  display: flex;
  font-weight: ${typography.weights.normal};
  height: min-content;

  > * {
    margin-left: ${spacing.xsmall};
  }
`

export default Controls
