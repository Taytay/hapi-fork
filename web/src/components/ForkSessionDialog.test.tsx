import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n-context';
import { ForkSessionDialog } from './ForkSessionDialog';

function renderWithProviders(ui: React.ReactElement) {
    return render(<I18nProvider>{ui}</I18nProvider>);
}

describe('ForkSessionDialog', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        sessionName: 'My Session',
        sessionId: 'session-123',
        directory: '/home/user/project',
        agent: 'claude' as const,
        model: 'auto',
        onFork: vi.fn(),
        isPending: false,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the fork dialog with pre-filled values', () => {
        renderWithProviders(<ForkSessionDialog {...defaultProps} />);

        expect(screen.getByText('Fork Session')).toBeInTheDocument();
        expect(screen.getByDisplayValue('/home/user/project')).toBeInTheDocument();

        const claudeRadio = screen.getByRole('radio', { name: /claude/i });
        expect(claudeRadio).toBeChecked();
    });

    it('does not render when closed', () => {
        renderWithProviders(<ForkSessionDialog {...defaultProps} isOpen={false} />);

        expect(screen.queryByText('Fork Session')).not.toBeInTheDocument();
    });

    it('allows changing directory', () => {
        renderWithProviders(<ForkSessionDialog {...defaultProps} />);

        const dirInput = screen.getByDisplayValue('/home/user/project');
        fireEvent.change(dirInput, { target: { value: '/new/path' } });
        expect(dirInput).toHaveValue('/new/path');
    });

    it('allows changing agent', () => {
        renderWithProviders(<ForkSessionDialog {...defaultProps} />);

        const codexRadio = screen.getByRole('radio', { name: /codex/i });
        fireEvent.click(codexRadio);
        expect(codexRadio).toBeChecked();
    });

    it('calls onFork with correct options when submitted', async () => {
        const onFork = vi.fn().mockResolvedValue(undefined);
        renderWithProviders(<ForkSessionDialog {...defaultProps} onFork={onFork} />);

        fireEvent.click(screen.getByRole('button', { name: 'Fork' }));

        await waitFor(() => {
            expect(onFork).toHaveBeenCalledWith({
                directory: '/home/user/project',
                agent: 'claude',
                model: 'auto',
                yolo: false,
                resumeSessionId: undefined,
            });
        });
    });

    it('passes resumeSessionId when resume is toggled', async () => {
        const onFork = vi.fn().mockResolvedValue(undefined);
        renderWithProviders(<ForkSessionDialog {...defaultProps} onFork={onFork} />);

        // Toggle resume checkbox
        const resumeCheckbox = screen.getByRole('checkbox', { name: '' });
        // There are two checkboxes - yolo and resume. Find by the label text nearby
        const resumeLabel = screen.getByText('Resume conversation');
        const resumeToggle = resumeLabel.closest('div')?.parentElement?.querySelector('input[type="checkbox"]');
        expect(resumeToggle).toBeTruthy();
        fireEvent.click(resumeToggle!);

        fireEvent.click(screen.getByRole('button', { name: 'Fork' }));

        await waitFor(() => {
            expect(onFork).toHaveBeenCalledWith(
                expect.objectContaining({
                    resumeSessionId: 'session-123',
                }),
            );
        });
    });

    it('disables form controls when isPending', () => {
        renderWithProviders(<ForkSessionDialog {...defaultProps} isPending={true} />);

        const dirInput = screen.getByDisplayValue('/home/user/project');
        expect(dirInput).toBeDisabled();
    });

    it('shows error message on fork failure', async () => {
        const onFork = vi.fn().mockRejectedValue(new Error('Machine offline'));
        renderWithProviders(<ForkSessionDialog {...defaultProps} onFork={onFork} />);

        fireEvent.click(screen.getByRole('button', { name: 'Fork' }));

        await waitFor(() => {
            expect(screen.getByText('Machine offline')).toBeInTheDocument();
        });
    });

    it('shows description with session name', () => {
        renderWithProviders(<ForkSessionDialog {...defaultProps} sessionName="Test Session" />);

        expect(screen.getByText(/Test Session/)).toBeInTheDocument();
    });

    it('pre-fills agent from codex session', () => {
        renderWithProviders(<ForkSessionDialog {...defaultProps} agent="codex" />);

        const codexRadio = screen.getByRole('radio', { name: /codex/i });
        expect(codexRadio).toBeChecked();
    });
});
