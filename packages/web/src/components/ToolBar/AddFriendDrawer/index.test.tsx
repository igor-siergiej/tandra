import { fireEvent, render, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useGenerateFriendCode, useRedeemFriendCode } from '../../../hooks/useFriends';
import { fake, narrowTo } from '../../../testing/fake';
import { AddFriendDrawer } from './index';

vi.mock('../../../hooks/useFriends', () => ({
    useGenerateFriendCode: vi.fn(),
    useRedeemFriendCode: vi.fn(),
}));

const mockedUseGenerateFriendCode = vi.mocked(useGenerateFriendCode);
const mockedUseRedeemFriendCode = vi.mocked(useRedeemFriendCode);

const drawerContent = () => within(narrowTo(document.querySelector('[data-vaul-drawer]'), HTMLElement));

describe('AddFriendDrawer', () => {
    const noop = () => {};
    let generateMutate: ReturnType<typeof vi.fn>;
    let redeemMutate: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        generateMutate = vi.fn();
        redeemMutate = vi.fn();
        mockedUseGenerateFriendCode.mockReturnValue(
            fake({
                mutate: generateMutate,
                data: undefined,
                isPending: false,
                error: null,
                isError: false,
                reset: vi.fn(),
            })
        );
        mockedUseRedeemFriendCode.mockReturnValue(
            fake({
                mutate: redeemMutate,
                data: undefined,
                isPending: false,
                error: null,
                isError: false,
                reset: vi.fn(),
            })
        );
    });

    it('invite mode: clicking "Generate invite code" calls generate and shows the returned code', () => {
        generateMutate.mockImplementation(() => {
            mockedUseGenerateFriendCode.mockReturnValue(
                fake({
                    mutate: generateMutate,
                    data: { code: 'ABC123', expiresAt: new Date(Date.now() + 60_000).toISOString() },
                    isPending: false,
                    error: null,
                    isError: false,
                    reset: vi.fn(),
                })
            );
        });

        const { rerender } = render(<AddFriendDrawer open onOpenChange={noop} />);
        fireEvent.click(drawerContent().getByRole('button', { name: 'Generate invite code' }));
        expect(generateMutate).toHaveBeenCalled();

        rerender(<AddFriendDrawer open onOpenChange={noop} />);
        expect(drawerContent().getByText('ABC123')).toBeInTheDocument();
    });

    // input-otp schedules an internal setTimeout(0) to sync its selection "mirror" on mount/change;
    // flushing a macrotask keeps it from firing after happy-dom tears the test environment down.
    const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

    it('enter mode: entering 6 chars and clicking "Add friend" calls redeem', async () => {
        render(<AddFriendDrawer open onOpenChange={noop} />);
        fireEvent.click(drawerContent().getByRole('button', { name: 'Enter a code' }));

        const otpInput = narrowTo(document.querySelector('input[data-input-otp]'), HTMLInputElement);
        fireEvent.change(otpInput, { target: { value: 'ABC123' } });

        fireEvent.click(drawerContent().getByRole('button', { name: 'Add friend' }));
        expect(redeemMutate).toHaveBeenCalledWith('ABC123', expect.anything());
        await flush();
    });

    it('enter mode: pasting a mixed-case code with stray characters sanitizes it to an uppercase code', async () => {
        render(<AddFriendDrawer open onOpenChange={noop} />);
        fireEvent.click(drawerContent().getByRole('button', { name: 'Enter a code' }));

        const otpInput = narrowTo(document.querySelector('input[data-input-otp]'), HTMLInputElement);
        fireEvent.paste(otpInput, { clipboardData: { getData: () => 'ab-cd 12' } });

        fireEvent.click(drawerContent().getByRole('button', { name: 'Add friend' }));
        expect(redeemMutate).toHaveBeenCalledWith('ABCD12', expect.anything());
        await flush();
    });

    it('shows the expired-code error message on a rejected redeem', async () => {
        mockedUseRedeemFriendCode.mockReturnValue(
            fake({
                mutate: redeemMutate,
                data: undefined,
                isPending: false,
                error: Object.assign(new Error('This code has expired'), { status: 410 }),
                isError: true,
                reset: vi.fn(),
            })
        );

        render(<AddFriendDrawer open onOpenChange={noop} />);
        fireEvent.click(drawerContent().getByRole('button', { name: 'Enter a code' }));

        expect(drawerContent().getByText('This code has expired')).toBeInTheDocument();
        await flush();
    });
});
