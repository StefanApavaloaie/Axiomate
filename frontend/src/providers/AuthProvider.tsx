import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { authApi } from '@/api'
import { TokenStorage } from '@/api/client'
import type { UserProfile } from '@/types'

interface AuthContextValue {
    user: UserProfile | null
    isLoading: boolean
    isAuthenticated: boolean
    logout: () => void
    setUser: (user: UserProfile | null) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserProfile | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const token = TokenStorage.getAccess()
        if (!token) {
            setIsLoading(false)
            return
        }
        authApi
            .getMe()
            .then((profile) => setUser(profile))
            .catch(() => {
                TokenStorage.clear()
                setUser(null)
            })
            .finally(() => setIsLoading(false))
    }, [])

    const logout = () => {
        TokenStorage.clear()
        setUser(null)
        window.location.href = '/login'
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated: !!user,
                logout,
                setUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export function useAuthContext(): AuthContextValue {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider')
    return ctx
}
