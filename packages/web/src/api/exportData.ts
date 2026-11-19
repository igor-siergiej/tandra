// The server names the file in Content-Disposition; read it back so the saved name matches what it sent.
const filenameFrom = (response: Response): string => {
    const match = /filename="?([^";]+)"?/.exec(response.headers.get('Content-Disposition') ?? '');

    return match?.[1] ?? 'tandra-export.json';
};

/** Downloads everything the signed-in user has in Tandra as one JSON file. The session cookie rides along same-origin. */
export const downloadMyData = async (): Promise<void> => {
    const response = await fetch('/api/export');

    if (response.status === 401) window.dispatchEvent(new CustomEvent('auth:session-expired'));

    if (!response.ok) throw new Error('Export request failed');

    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = filenameFrom(response);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};
