import { createContext, useContext } from 'react'
import type { Account } from '@ntfy-cf/shared'

interface AccountContextType {
  account: Account | null
  token: string | null
  setAccount: (account: Account | null, token?: string | null) => void
  logout: () => void
}

export const AccountContext = createContext<AccountContextType>({
  account: null,
  token: null,
  setAccount: () => {},
  logout: () => {},
})

export function useAccount(): AccountContextType {
  return useContext(AccountContext)
}
