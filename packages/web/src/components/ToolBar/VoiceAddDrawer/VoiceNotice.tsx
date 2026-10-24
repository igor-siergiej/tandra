import { PRIVACY_NOTICE_URL } from '../../PrivacyLink';
import { Button } from '../../ui/button';

export interface VoiceNoticeProps {
    onAcknowledge: () => void;
}

/** Shown once before the mic first opens: says who hears the audio and who gets the words. */
export const VoiceNotice = ({ onAcknowledge }: VoiceNoticeProps) => (
    <div className="space-y-3 text-sm">
        <p>
            Your browser's speech service (Google in Chrome, Apple in Safari) turns what you say into text. Tandra never
            receives the audio.
        </p>
        <p>The text is then sent to fal.ai, an AI service, to turn it into list items.</p>
        <a
            href={PRIVACY_NOTICE_URL}
            target="_blank"
            rel="noopener"
            className="block text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
            Read the privacy policy
        </a>
        <Button className="w-full" onClick={onAcknowledge}>
            Got it
        </Button>
    </div>
);
