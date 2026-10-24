export const PRIVACY_NOTICE_URL = 'https://tandra.uk/privacy';

/** Link to the privacy notice on the public site; it opens in a new tab so the app keeps its state. */
export const PrivacyLink = () => (
    <a
        href={PRIVACY_NOTICE_URL}
        target="_blank"
        rel="noopener"
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
    >
        Privacy
    </a>
);
