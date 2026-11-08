import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// Android's share sheet has no dedicated URL slot: the browser doing the sharing (Firefox,
// Chrome, etc.) puts the link in the `text` extra, occasionally `title` — `url` is reliably
// empty. Pull the first URL out of whichever field actually has it.
const extractUrl = (value: string): string => /https?:\/\/\S+/.exec(value)?.[0] ?? '';

const ShareTargetPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    useEffect(() => {
        const rawUrl = searchParams.get('url') ?? '';
        const text = searchParams.get('text') ?? '';
        const title = searchParams.get('title') ?? '';
        const url = rawUrl || extractUrl(text) || extractUrl(title);

        const params = new URLSearchParams();

        if (url) params.set('sharedUrl', url);

        if (title) params.set('sharedTitle', title);
        navigate(`/recipes?${params.toString()}`, { replace: true });
    }, [searchParams, navigate]);

    return null;
};

export default ShareTargetPage;
