/**
 * Verbatim from the dashboard:
 * `app/src/containers/BusinessHome/BusinessStatusBar/StatusChangeModal`.
 *
 * Two substitutions and nothing else: the redux `updateBusinessReview`
 * dispatch is `setReviewStatus` against the browser store, and the Segment
 * `track` call is gone — there is no Segment here.
 */
import type React from 'react'
import { useState } from 'react'

import { Attribute, FormField, Icon, Modal, Form, theme, useMiddeskForm } from '@/core'
import styled from 'styled-components'

import { setReviewStatus, type ReviewStatus } from '../../lib/review'
import StatusPill from '../StatusPill'

const { colors } = theme

type Props = {
  modalOpen: boolean
  setModalOpen: (modalOpen: boolean) => void
  previousStatus: string
  newStatus: string
  businessId: string
}

type StatusChangeFormValues = {
  note: string
}

const ArrowDiv = styled.div`
  align-items: center;
  display: flex;
  justify-content: center;
  padding-left: 10px;
  padding-right: 10px;
`

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const statusButtonLabel = (status: string) => {
  let formattedStatus = capitalize(status)

  if (status === 'in_review') {
    formattedStatus = 'Needs Review'
  }

  return formattedStatus
}

const StatusChangeDiv = styled.div`
  display: flex;
  padding-bottom: 30px;
`

const NoteTextArea = styled.textarea`
  border: 1px solid ${colors.frost};
  border-radius: 4px;
  margin-top: 5px;
  min-height: 100px;
  outline: none;
  padding: 8px;
  resize: none;
  width: 100%;
`

const NoteArea = ({ setNote }: { setNote: (val: string | null) => void }) => {
  return (
    <FormField<StatusChangeFormValues, 'note'>
      name='note'
      render={({ field }) => (
        <label htmlFor='note'>
          <Attribute label='Notes' optional>
            <NoteTextArea
              id='note'
              name={field.name}
              autoComplete='false'
              autoFocus
              value={field.value ?? ''}
              onBlur={field.onBlur}
              ref={field.ref}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                setNote(e.target.value)
                field.onChange(e)
              }}
            />
          </Attribute>
        </label>
      )}
    />
  )
}

export const StatusChangeModal = ({
  previousStatus,
  newStatus,
  modalOpen,
  setModalOpen,
  businessId
}: Props) => {
  const [note, setNote] = useState<string | null>(null)

  const form = useMiddeskForm<StatusChangeFormValues>({
    defaultValues: {
      note: ''
    }
  })

  const handleSubmit = () => {
    setReviewStatus(businessId, newStatus as ReviewStatus, previousStatus as ReviewStatus, note ?? undefined)
    setModalOpen(false)
  }

  return (
    <Modal
      isOpen={modalOpen}
      title='Change Status'
      closeLabel='Cancel'
      close={() => setModalOpen(false)}
      onCloseIconClick={() => setModalOpen(false)}
      onRequestClose={() => setModalOpen(false)}
      confirmLabel='Submit'
      confirm={() => handleSubmit()}
      overlayStyles={{ zIndex: 5 }}
      styles={{
        width: '600px'
      }}
    >
      <Form form={form} onSubmit={handleSubmit}>
        <StatusChangeDiv>
          <StatusPill type={previousStatus} text={statusButtonLabel(previousStatus)}></StatusPill>
          <ArrowDiv>
            <Icon name='arrowRight' color={colors.graphite} size={20} />
          </ArrowDiv>
          <StatusPill type={newStatus} text={statusButtonLabel(newStatus)}></StatusPill>
        </StatusChangeDiv>
        <NoteArea setNote={setNote} />
      </Form>
    </Modal>
  )
}
