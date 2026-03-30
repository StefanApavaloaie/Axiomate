import { useAuthContext } from '@/providers/AuthProvider'

// Re-export the main auth hook for convenient usage
export const useAuth = useAuthContext

// Convenience hook: returns just the current user
export function useCurrentUser() {
    const { user, isLoading } = useAuthContext()
    return { user, isLoading }
}

// Convenience hook: check if authenticated
export function useIsAuthenticated() {
    const { isAuthenticated, isLoading } = useAuthContext()
    return { isAuthenticated, isLoading }
}
