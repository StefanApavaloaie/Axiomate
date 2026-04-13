/**
 * Authenticated CSV download utility.
 * Fetches an export endpoint with the JWT auth token,
 * then triggers a file download in the browser using a temporary anchor element.
 */
export async function downloadCsv(url: string, filename: string): Promise<void> {
    const token = localStorage.getItem('axiomate_access_token')
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
        throw new Error(`Export failed: ${response.status} ${response.statusText}`)
    }

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(objectUrl)
}
