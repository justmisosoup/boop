import type React from 'react'
import type { FC, ReactNode, CSSProperties } from 'react'

import ReactModal from 'react-modal'
import styled from 'styled-components'

import { Button } from './Button'
import { Icon } from './Icon'
import { typography, spacing, colors } from './theme'

const CLOSE_SIZE = 18
const CLOSE_POSITION_OFFSET = '1px'

export type ModalProps = ReactModal.Props & {
  /**
   * The event handler that is executed when modal is dismissed.
   * @default () => {}
   */
  close: React.MouseEventHandler
  /**
   * The text in the close button.
   * @default Close
   */
  closeLabel?: string
  /**
   * If only action is close, display only close button
   * @default false
   */
  closeOnly?: boolean
  /**
   * The event handler that is executed when modal is acknowledged.
   * @default () => {}
   */
  confirm?: React.MouseEventHandler
  /**
   * The text in the confirm button.
   * @default Ok
   */
  confirmLabel?: string
  /**
   * Is the confirm button disabled?
   * @default false
   */
  isConfirmDisabled?: boolean
  children?: ReactNode
  /**
   * If the modal is open.
   * @default false
   */
  isOpen: boolean
  /**
   * The event handler that is executed when the close icon is clicked.
   * @default () => {}
   */
  onCloseIconClick?: React.MouseEventHandler
  /**
   * Styles applied to the Modal Overlay.
   * @default {}
   */
  overlayStyles?: CSSProperties
  /**
   * The styles applied to the Modal Body.
   * @default {}
   */
  styles?: CSSProperties
  /**
   * The header text for the model.
   * @default Title
   */
  title: string
  hideFooter?: boolean
  /**
   * Is the footer shown in the modal?
   * @default false
   */
}

const Header = styled.div`
  align-items: center;
  border-bottom: 2px solid ${colors.dawn};
  display: flex;
  justify-content: space-between;
  padding: ${spacing.normal} 40px;
`

const Title = styled.div`
  font-family: ${typography.faces.display};
  font-size: ${typography.sizes.xlarge};
`

const CloseIconDiv = styled.div`
  cursor: pointer;
  position: relative;
  top: ${CLOSE_POSITION_OFFSET};
`

const IconButton = styled.button`
  appearance: none;
  background: none;
  border: none;
`

const Body = styled.div`
  overflow-y: auto;
  padding: ${spacing.normal} 40px;
`

const Footer = styled.div`
  align-items: center;
  border-top: 2px solid ${colors.dawn};
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  padding: ${spacing.normal} 40px;

  > button:first-child {
    margin-right: ${spacing.compact};
  }
`

const generateDefaultStyles = (
  styles: CSSProperties,
  overlayStyles: CSSProperties
): ReactModal.Styles => {
  const modalStyles: ReactModal.Styles = {
    overlay: {
      alignItems: 'center',
      background: 'rgba(255, 255, 255, 0.75)',
      bottom: 0,
      display: 'flex',
      justifyContent: 'center',
      left: 0,
      position: 'fixed',
      right: 0,
      top: 0,
      ...overlayStyles
    },
    content: {
      background: 'white',
      borderRadius: 10,
      boxShadow: 'rgba(0, 0, 0, 0.2) 0px 0px 25px',
      margin: 0,
      outline: 'none',
      padding: 0,
      ...styles
    }
  }

  return modalStyles
}

export const Modal: FC<ModalProps> = ({
  children,
  close,
  closeLabel = 'Close',
  confirm,
  confirmLabel = 'Ok',
  isConfirmDisabled,
  closeOnly,
  onCloseIconClick = close,
  overlayStyles = {},
  styles = {},
  title = 'Title',
  hideFooter,
  ...props
}: ModalProps): JSX.Element => {
  ReactModal.defaultStyles = generateDefaultStyles(styles, overlayStyles)

  return (
    <ReactModal ariaHideApp={false} {...props}>
      <Header>
        <Title>{title}</Title>
        {!closeOnly && onCloseIconClick && (
          <IconButton
            aria-label='close'
            onClick={onCloseIconClick}
            type='button'
          >
            <CloseIconDiv>
              <Icon name='cross2' size={CLOSE_SIZE} />
            </CloseIconDiv>
          </IconButton>
        )}
      </Header>
      <Body>{children}</Body>
      {!hideFooter && (
        <Footer>
          {close && (
            <Button onClick={close} type={confirm ? 'secondary' : 'primary'}>
              {closeLabel}
            </Button>
          )}
          {confirm && (
            <Button disabled={isConfirmDisabled} onClick={confirm}>
              {confirmLabel}
            </Button>
          )}
        </Footer>
      )}
    </ReactModal>
  )
}
