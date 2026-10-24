import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const speech = vi.hoisted(() => ({
    supported: true,
    listening: false,
    transcript: '',
    error: null as string | null,
    start: vi.fn(),
    stop: vi.fn(),
    reset: vi.fn(),
}));
const parse = vi.hoisted(() => vi.fn());

vi.mock('../../../hooks/useSpeechRecognition', () => ({ useSpeechRecognition: () => speech }));
vi.mock('../../../api', () => ({ parseSpokenItems: parse }));
vi.mock('../../ui/drawer', () => ({
    Drawer: ({ open, children }: any) => (open ? <div>{children}</div> : null),
    DrawerContent: ({ children }: any) => <div>{children}</div>,
    DrawerHeader: ({ children }: any) => <div>{children}</div>,
    DrawerTitle: ({ children }: any) => <h2>{children}</h2>,
    DrawerFooter: ({ children }: any) => <div>{children}</div>,
}));

import { VoiceAddDrawer } from './index';

const renderDrawer = (onAddMany = vi.fn().mockResolvedValue(undefined), onOpenChange = vi.fn()) => {
    render(<VoiceAddDrawer open onOpenChange={onOpenChange} onAddMany={onAddMany} />);
    return { onAddMany, onOpenChange };
};

describe('VoiceAddDrawer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem('tandra.voiceAck', 'true');
        Object.assign(speech, { listening: false, transcript: '', error: null });
        parse.mockResolvedValue([
            { name: 'bread', quantity: 2, unit: 'loaf' },
            { name: 'milk' },
            { name: 'eggs', quantity: 12 },
        ]);
    });

    it('starts listening when the mic is tapped', () => {
        renderDrawer();

        fireEvent.click(screen.getByRole('button', { name: 'Start listening' }));

        expect(speech.start).toHaveBeenCalled();
    });

    it('explains where speech goes before the mic first opens, then listens once acknowledged', () => {
        localStorage.clear();
        renderDrawer();

        fireEvent.click(screen.getByRole('button', { name: 'Start listening' }));

        expect(speech.start).not.toHaveBeenCalled();
        expect(screen.getByText(/browser's speech service/)).toBeInTheDocument();
        expect(screen.getByText(/sent to fal\.ai/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Read the privacy policy' })).toHaveAttribute(
            'href',
            'https://tandra.uk/privacy'
        );

        fireEvent.click(screen.getByRole('button', { name: 'Got it' }));

        expect(speech.start).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem('tandra.voiceAck')).toBe('true');
        expect(screen.queryByRole('button', { name: 'Got it' })).not.toBeInTheDocument();
    });

    it('cancelling the notice leaves the mic closed and unacknowledged', () => {
        localStorage.clear();
        const { onOpenChange } = renderDrawer();

        fireEvent.click(screen.getByRole('button', { name: 'Start listening' }));
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(speech.start).not.toHaveBeenCalled();
        expect(localStorage.getItem('tandra.voiceAck')).toBeNull();
    });

    it('parses the finished transcript and lists every item for confirmation, adding nothing yet', async () => {
        speech.transcript = 'two loaves of bread, milk and a dozen eggs';
        const { onAddMany } = renderDrawer();

        await screen.findByText('bread');

        expect(parse).toHaveBeenCalledWith('two loaves of bread, milk and a dozen eggs');
        expect(screen.getByText('2 loaf')).toBeInTheDocument();
        expect(screen.getByText('milk')).toBeInTheDocument();
        expect(onAddMany).not.toHaveBeenCalled();
    });

    it('adds only the items left ticked', async () => {
        speech.transcript = 'stuff';
        const { onAddMany, onOpenChange } = renderDrawer();
        await screen.findByText('bread');

        fireEvent.click(screen.getByRole('checkbox', { name: /milk/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Add 2 items' }));

        await waitFor(() =>
            expect(onAddMany).toHaveBeenCalledWith([
                { name: 'bread', quantity: 2, unit: 'loaf' },
                { name: 'eggs', quantity: 12 },
            ])
        );
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('shows a message when nothing was understood', async () => {
        parse.mockResolvedValue([]);
        speech.transcript = 'mumble';
        renderDrawer();

        expect(await screen.findByRole('alert')).toHaveTextContent("couldn't find any items");
    });

    it('shows the recognition error', () => {
        speech.error = 'Microphone access was blocked.';
        renderDrawer();

        expect(screen.getByRole('alert')).toHaveTextContent('Microphone access was blocked.');
    });

    it('keeps the drawer open and shows the error when adding fails', async () => {
        speech.transcript = 'stuff';
        const { onOpenChange } = renderDrawer(vi.fn().mockRejectedValue(new Error('List not found')));
        await screen.findByText('bread');

        fireEvent.click(screen.getByRole('button', { name: 'Add 3 items' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('List not found');
        expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    it('parses a transcript once when the parser fails, and shows the error', async () => {
        parse.mockRejectedValue(new Error('Too many AI requests'));
        speech.transcript = 'bread';
        renderDrawer();

        expect(await screen.findByRole('alert')).toHaveTextContent('Too many AI requests');
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(parse).toHaveBeenCalledTimes(1);
    });
});
