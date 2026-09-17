import type React from 'react'
import { useState, useCallback, useRef } from 'react'

import {
  type FileError,
  type FileWithPath,
  useDropzone,
  type Accept as DropzoneAccept
} from 'react-dropzone'
import styled from 'styled-components'

import { Attribute } from './Attribute'
import Loader from './Loader'
import { colors, spacing, typography } from './theme'

const DROPZONE_HEIGHT = '46px'

const DropZoneBox = styled.div`
  > div {
    display: flex;
    height: ${DROPZONE_HEIGHT};
    justify-content: center;
    padding: 12px 0;
  }
`

type DropContentProps = DropzoneFile[]

type Accept = DropzoneAccept | string | string[]

export type DropzoneFile = {
  data: ArrayBuffer | string
  name: string
  path: string
}

export type OnDrop = {
  (files: Array<DropzoneFile>, afterDrop: (...args: unknown[]) => void): void
}

const readFiles = (contents: FileWithPath[]) =>
  Promise.all(
    contents.map(
      f =>
        new Promise(resolve => {
          const reader = new FileReader()

          /* eslint-disable no-console */
          reader.onabort = () => console.error('File reading was aborted')
          reader.onerror = () => console.error('File reading failed')
          /* eslint-enable no-console */
          reader.onload = () =>
            resolve({
              data: reader.result,
              name: f.name,
              path: f.path
            })
          reader.readAsArrayBuffer(f)
        })
    )
  ) as Promise<DropContentProps>

const ActiveDropzone = styled.div`
  background-color: ${colors.blueLight};
  border: 2px solid ${colors.blue};
  border-radius: 4px;
  box-sizing: border-box;
  color: ${colors.blueDark};
  font-size: ${typography.sizes.medium};
`

const InactiveDropzone = styled.div`
  background-color: white;
  border: 2px dashed ${colors.frost};
  border-radius: 4px;
  box-sizing: border-box;
  color: ${colors.karl};
  font-size: ${typography.sizes.medium};
`

const LoadingDropzone = styled.div`
  align-items: center;
  background-color: ${colors.dawn};
  border: 2px solid ${colors.midnight};
  border-radius: 4px;
  box-sizing: border-box;
  color: ${colors.midnight};
  display: flex;
  font-size: ${typography.sizes.medium};
  justify-content: center;
  padding: 12px 0;
`

const SpinnerBox = styled.div`
  margin-left: 10px;
`

const Spinner = () => (
  <SpinnerBox>
    <Loader size='small' color={colors.midnight} />
  </SpinnerBox>
)

const StyledDropzone = styled.div<{ name?: string }>`
  margin-top: 5px;
  outline: none;

  a {
    color: ${colors.blue};
    cursor: pointer;
  }
`

const RejectedFile = styled.div`
  color: ${colors.red};
  font-size: ${typography.sizes.small};
  margin-top: ${spacing.compact};
`

const validator = (
  file: File,
  customValidator?: <T extends File>(file: T) => FileError | FileError[] | null
) => {
  if (file.size === 0) {
    return {
      code: 'file-empty',
      message: 'This file is empty'
    }
  }

  if (customValidator) {
    return customValidator(file)
  }

  return null
}

const toDropzoneAccept = (accept?: Accept): DropzoneAccept | undefined => {
  if (!accept) return undefined
  if (typeof accept === 'object' && !Array.isArray(accept)) return accept

  const values = Array.isArray(accept) ? accept : accept.split(',')

  return values.reduce<DropzoneAccept>((memo, value) => {
    const key = value.trim()
    if (!key) return memo

    return { ...memo, [key]: [] }
  }, {})
}

type DropzoneProps = {
  onDrop: (
    content: DropContentProps,
    setProcessing: (processing: boolean) => void
  ) => void
  dragEnter?: (e: React.DragEvent) => void
  loadingText?: string
  activeText?: string
  inactiveText?: string
  accept?: Accept
  label?: string
  validator?: <T extends File>(file: T) => FileError | FileError[] | null
  name?: string
}

const Dropzone = ({
  onDrop,
  label,
  dragEnter,
  loadingText,
  activeText,
  inactiveText,
  accept,
  validator: customValidator,
  name
}: DropzoneProps) => {
  const [processing, setProcessing] = useState(false)
  const dropzoneRef = useRef<HTMLDivElement>(null)

  const drop = useCallback(
    (content: FileWithPath[]) => {
      setProcessing(true)
      readFiles(content)
        .then(c => {
          onDrop(c, setProcessing)
        })
        .catch(() => {
          setProcessing(false)
        })
    },
    [onDrop]
  )

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop: drop,
      accept: toDropzoneAccept(accept),
      validator: file => validator(file, customValidator)
    })

  const dropzone = (
    <>
      <StyledDropzone {...getRootProps()} ref={dropzoneRef} name={name}>
        <input {...getInputProps()} />
        <DropZoneBox onDragEnter={e => dragEnter && dragEnter(e)}>
          {processing ? (
            <LoadingDropzone>
              <span>{loadingText}</span>
              <Spinner />
            </LoadingDropzone>
          ) : isDragActive ? (
            <ActiveDropzone>{activeText}</ActiveDropzone>
          ) : (
            <InactiveDropzone>{inactiveText}</InactiveDropzone>
          )}
        </DropZoneBox>
      </StyledDropzone>
      {(fileRejections || []).map(({ file, errors }) => (
        <RejectedFile key={file.lastModified}>
          {(errors || []).map(({ message }) => `${file.name}: ${message}`)}
        </RejectedFile>
      ))}
    </>
  )

  if (label) {
    return <Attribute label={label}>{dropzone}</Attribute>
  }

  return dropzone
}

export default Dropzone
