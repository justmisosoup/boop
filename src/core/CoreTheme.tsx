import React from 'react'

export type CoreThemeMode = 'light' | 'dark'

const CoreThemeContext = React.createContext<CoreThemeMode>('light')

export const CoreThemeProvider = ({
  children,
  themeMode = 'light'
}: {
  children: React.ReactNode
  themeMode?: CoreThemeMode
}) => (
  <CoreThemeContext.Provider value={themeMode}>
    {children}
  </CoreThemeContext.Provider>
)

export const useCoreThemeMode = () => React.useContext(CoreThemeContext)
