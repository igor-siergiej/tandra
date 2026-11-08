import { REGEXP_ONLY_DIGITS_AND_CHARS } from 'input-otp';
import { KeyRound, Plus, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '../../../components/ui/drawer';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../../../components/ui/input-otp';
import { RippleButton } from '../../../components/ui/ripple';
import { useGenerateFriendCode, useRedeemFriendCode } from '../../../hooks/useFriends';
import { cn } from '../../../lib/utils';

export interface AddFriendDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type Mode = 'invite' | 'enter';

const OTP_LENGTH = 6;
const CLOSE_DELAY_MS = 900;

// Codes are generated from an uppercase-letters-and-digits alphabet (see FriendService),
// so normalize typed/pasted input to match regardless of case or stray whitespace.
const sanitizeCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

interface ModeToggleProps {
    mode: Mode;
    onSwitchMode: (mode: Mode) => void;
}

const ModeToggle = ({ mode, onSwitchMode }: ModeToggleProps) => (
    <div className="flex gap-1 rounded-lg border border-input bg-muted/30 p-1">
        {(
            [
                { value: 'invite', label: 'Create invite', icon: Send },
                { value: 'enter', label: 'Enter a code', icon: KeyRound },
            ] as const
        ).map(({ value, label, icon: Icon }) => (
            <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => onSwitchMode(value)}
                className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors',
                    mode === value
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                )}
            >
                <Icon className="h-4 w-4" />
                {label}
            </button>
        ))}
    </div>
);

const formatCountdown = (secondsLeft: number): string => {
    if (secondsLeft <= 0) return 'Expired';

    const mm = Math.floor(secondsLeft / 60)
        .toString()
        .padStart(2, '0');

    const ss = (secondsLeft % 60).toString().padStart(2, '0');

    return `${mm}:${ss}`;
};

interface InvitePanelProps {
    generated: { code: string; expiresAt: string } | undefined;
    isGenerating: boolean;
    secondsLeft: number;
    copyFeedback: string;
    onGenerate: () => void;
    onShare: () => void;
    onCopy: () => void;
}

const InvitePanel = ({
    generated,
    isGenerating,
    secondsLeft,
    copyFeedback,
    onGenerate,
    onShare,
    onCopy,
}: InvitePanelProps) => {
    if (!generated) {
        return (
            <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                    Generates a one-time code you send to a friend. Once they enter it on their end, you're connected —
                    no need for them to invite you back.
                </p>
                <Button className="w-full" disabled={isGenerating} onClick={onGenerate}>
                    {isGenerating ? 'Generating…' : 'Generate invite code'}
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
                Send this code to your friend — they'll enter it under "Enter a code" to add you.
            </p>
            <p className="font-mono text-3xl tracking-widest">{generated.code}</p>
            <p className="text-sm text-muted-foreground">Expires in {formatCountdown(secondsLeft)}</p>
            <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={onShare}>
                    Share code
                </Button>
                <Button variant="outline" className="flex-1" onClick={onCopy}>
                    Copy
                </Button>
            </div>
            {copyFeedback && <p className="text-sm text-muted-foreground">{copyFeedback}</p>}
        </div>
    );
};

const resolveRedeemErrorMessage = (isRedeemError: boolean, redeemError: Error | null): string | null => {
    if (!isRedeemError) return null;

    if (!(redeemError instanceof Error)) return null;

    return redeemError.message;
};

interface EnterCodePanelProps {
    otp: string;
    onOtpChange: (value: string) => void;
    isRedeeming: boolean;
    redeemSuccess: boolean;
    redeemError: Error | null;
    isRedeemError: boolean;
    onRedeem: () => void;
}

// fallow-ignore-next-line complexity
const EnterCodePanel = ({
    otp,
    onOtpChange,
    isRedeeming,
    redeemSuccess,
    redeemError,
    isRedeemError,
    onRedeem,
}: EnterCodePanelProps) => {
    if (redeemSuccess) {
        return <p className="text-center text-sm text-primary">Friend added!</p>;
    }

    const redeemErrorMessage = resolveRedeemErrorMessage(isRedeemError, redeemError);

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Got a code from a friend? Enter it below to add them.</p>
            <div className="flex justify-center">
                <InputOTP
                    maxLength={OTP_LENGTH}
                    value={otp}
                    onChange={onOtpChange}
                    pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
                    inputMode="text"
                    pasteTransformer={sanitizeCode}
                >
                    <InputOTPGroup>
                        {[0, 1, 2, 3, 4, 5].map((slotIndex) => (
                            <InputOTPSlot key={slotIndex} index={slotIndex} />
                        ))}
                    </InputOTPGroup>
                </InputOTP>
            </div>
            {redeemErrorMessage && <p className="text-center text-sm text-destructive">{redeemErrorMessage}</p>}
            <Button className="w-full" disabled={otp.length !== OTP_LENGTH || isRedeeming} onClick={onRedeem}>
                {isRedeeming ? 'Adding…' : 'Add friend'}
            </Button>
        </div>
    );
};

export const AddFriendDrawer = ({ open, onOpenChange }: AddFriendDrawerProps) => {
    const [mode, setMode] = useState<Mode>('invite');
    const [otp, setOtp] = useState('');
    const [copyFeedback, setCopyFeedback] = useState('');
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [redeemSuccess, setRedeemSuccess] = useState(false);
    const closeTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

    const {
        mutate: generateCode,
        data: generated,
        isPending: isGenerating,
        reset: resetGenerate,
    } = useGenerateFriendCode();

    const {
        mutate: redeemCode,
        isPending: isRedeeming,
        error: redeemError,
        isError: isRedeemError,
        reset: resetRedeem,
    } = useRedeemFriendCode();

    // Live mm:ss countdown to the code's expiry; re-derives on each tick from expiresAt
    // rather than counting down a stored duration, so it self-corrects if the tab was backgrounded.
    useEffect(() => {
        if (!generated?.expiresAt) return;
        const expiresAt = new Date(generated.expiresAt).getTime();

        const tick = () => setSecondsLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));

        tick();
        const interval = setInterval(tick, 1000);

        return () => clearInterval(interval);
    }, [generated?.expiresAt]);

    useEffect(
        () => () => {
            if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
        },
        []
    );

    const resetAll = () => {
        setMode('invite');
        setOtp('');
        setCopyFeedback('');
        setRedeemSuccess(false);
        resetGenerate();
        resetRedeem();
    };

    const handleOpenChange = (next: boolean) => {
        if (!next) resetAll();
        onOpenChange(next);
    };

    const handleSwitchMode = (next: Mode) => {
        setMode(next);
        setOtp('');
        resetRedeem();
    };

    const handleShare = async () => {
        if (!generated) return;

        if (navigator.share) {
            try {
                await navigator.share({ text: generated.code });

                return;
            } catch {
                // user cancelled or share unsupported at runtime — fall back to clipboard
            }
        }

        await navigator.clipboard.writeText(generated.code);
        setCopyFeedback('Copied to clipboard');
    };

    const handleCopy = async () => {
        if (!generated) return;
        await navigator.clipboard.writeText(generated.code);
        setCopyFeedback('Copied!');
    };

    const handleRedeem = () => {
        if (otp.length !== OTP_LENGTH) return;
        redeemCode(otp, {
            onSuccess: () => {
                setRedeemSuccess(true);
                closeTimeoutRef.current = setTimeout(() => handleOpenChange(false), CLOSE_DELAY_MS);
            },
        });
    };

    return (
        <Drawer open={open} onOpenChange={handleOpenChange}>
            <DrawerTrigger asChild>
                <RippleButton
                    size="icon"
                    className="h-12 w-12 rounded-full border-2 border-primary/20 hover:border-primary/40 transition-colors"
                    aria-label="Add friend"
                    onClick={() => handleOpenChange(true)}
                >
                    <Plus className="size-5" />
                </RippleButton>
            </DrawerTrigger>
            <DrawerContent>
                <div className="w-full sm:mx-auto sm:max-w-[400px]">
                    <DrawerHeader>
                        <DrawerTitle>Add Friend</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-4 pb-6 space-y-4">
                        <ModeToggle mode={mode} onSwitchMode={handleSwitchMode} />

                        <div className="flex min-h-[220px] flex-col justify-center">
                            {mode === 'invite' ? (
                                <InvitePanel
                                    generated={generated}
                                    isGenerating={isGenerating}
                                    secondsLeft={secondsLeft}
                                    copyFeedback={copyFeedback}
                                    onGenerate={() => generateCode()}
                                    onShare={() => void handleShare()}
                                    onCopy={() => void handleCopy()}
                                />
                            ) : (
                                <EnterCodePanel
                                    otp={otp}
                                    onOtpChange={(value) => setOtp(sanitizeCode(value))}
                                    isRedeeming={isRedeeming}
                                    redeemSuccess={redeemSuccess}
                                    redeemError={redeemError}
                                    isRedeemError={isRedeemError}
                                    onRedeem={handleRedeem}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    );
};
