import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

interface AppShellProps {
    children: ReactNode
}

export default function AppShell({ children }: AppShellProps) {
    return (
        <div className="min-h-screen bg-navy-950 flex">
            <Sidebar />
            <div className="flex-1 flex flex-col ml-64">
                <TopBar />
                <main className="flex-1 pt-14 overflow-auto">
                    <div className="p-6 animate-fade-in">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
