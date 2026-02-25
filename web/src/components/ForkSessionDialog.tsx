import { useEffect, useState } from 'react';
import { Spinner } from '@/components/Spinner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/lib/use-translation';
import type { AgentType } from './NewSession/types';
import { MODEL_OPTIONS } from './NewSession/types';

type ForkSessionDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    sessionName: string;
    sessionId: string;
    directory: string;
    agent: AgentType;
    model: string;
    onFork: (options: {
        directory: string;
        agent: AgentType;
        model: string;
        yolo: boolean;
        resumeSessionId?: string;
    }) => Promise<void>;
    isPending: boolean;
};

export function ForkSessionDialog(props: ForkSessionDialogProps) {
    const { t } = useTranslation();
    const { isOpen, onClose, sessionName, sessionId, directory: defaultDirectory, agent: defaultAgent, model: defaultModel, onFork, isPending } = props;

    const [directory, setDirectory] = useState(defaultDirectory);
    const [agent, setAgent] = useState<AgentType>(defaultAgent);
    const [model, setModel] = useState(defaultModel);
    const [yolo, setYolo] = useState(false);
    const [resume, setResume] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setDirectory(defaultDirectory);
            setAgent(defaultAgent);
            setModel(defaultModel);
            setYolo(false);
            setResume(false);
            setError(null);
        }
    }, [isOpen, defaultDirectory, defaultAgent, defaultModel]);

    const modelOptions = MODEL_OPTIONS[agent];

    useEffect(() => {
        const options = MODEL_OPTIONS[agent];
        if (options.length === 0) {
            setModel('auto');
        } else if (!options.find((o) => o.value === model)) {
            setModel('auto');
        }
    }, [agent, model]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedDir = directory.trim();
        if (!trimmedDir) return;

        setError(null);
        try {
            const resolvedModel = model !== 'auto' && agent !== 'opencode' ? model : undefined;
            await onFork({
                directory: trimmedDir,
                agent,
                model: resolvedModel ?? 'auto',
                yolo,
                resumeSessionId: resume ? sessionId : undefined,
            });
            onClose();
        } catch (err) {
            const message = err instanceof Error && err.message ? err.message : t('dialog.error.default');
            setError(message);
        }
    };

    const canFork = Boolean(directory.trim() && !isPending);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>{t('dialog.fork.title')}</DialogTitle>
                    <DialogDescription className="mt-2">
                        {t('dialog.fork.description', { name: sessionName })}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-[var(--app-hint)]">
                            {t('dialog.fork.directory')}
                        </label>
                        <input
                            type="text"
                            value={directory}
                            onChange={(e) => setDirectory(e.target.value)}
                            disabled={isPending}
                            className="w-full px-3 py-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] text-[var(--app-fg)] placeholder:text-[var(--app-hint)] focus:outline-none focus:ring-2 focus:ring-[var(--app-button)] focus:border-transparent text-sm"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-[var(--app-hint)]">
                            {t('dialog.fork.agent')}
                        </label>
                        <div className="flex gap-3">
                            {(['claude', 'codex', 'gemini', 'opencode'] as const).map((agentType) => (
                                <label key={agentType} className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="fork-agent"
                                        value={agentType}
                                        checked={agent === agentType}
                                        onChange={() => setAgent(agentType)}
                                        disabled={isPending}
                                        className="accent-[var(--app-link)]"
                                    />
                                    <span className="text-sm capitalize">{agentType}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {modelOptions.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-[var(--app-hint)]">
                                {t('dialog.fork.model')}
                            </label>
                            <select
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                disabled={isPending}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--app-divider)] bg-[var(--app-bg)] text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-[var(--app-link)] disabled:opacity-50"
                            >
                                {modelOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : null}

                    <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col">
                            <span className="text-sm text-[var(--app-fg)]">{t('dialog.fork.yolo')}</span>
                        </div>
                        <label className="relative inline-flex h-5 w-9 items-center">
                            <input
                                type="checkbox"
                                checked={yolo}
                                onChange={(e) => setYolo(e.target.checked)}
                                disabled={isPending}
                                className="peer sr-only"
                            />
                            <span className="absolute inset-0 rounded-full bg-[var(--app-border)] transition-colors peer-checked:bg-[var(--app-link)] peer-disabled:opacity-50" />
                            <span className="absolute left-0.5 h-4 w-4 rounded-full bg-[var(--app-bg)] transition-transform peer-checked:translate-x-4 peer-disabled:opacity-50" />
                        </label>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col">
                            <span className="text-sm text-[var(--app-fg)]">{t('dialog.fork.resume')}</span>
                            <span className="text-xs text-[var(--app-hint)]">{t('dialog.fork.resume.desc')}</span>
                        </div>
                        <label className="relative inline-flex h-5 w-9 items-center shrink-0">
                            <input
                                type="checkbox"
                                checked={resume}
                                onChange={(e) => setResume(e.target.checked)}
                                disabled={isPending}
                                className="peer sr-only"
                            />
                            <span className="absolute inset-0 rounded-full bg-[var(--app-border)] transition-colors peer-checked:bg-[var(--app-link)] peer-disabled:opacity-50" />
                            <span className="absolute left-0.5 h-4 w-4 rounded-full bg-[var(--app-bg)] transition-transform peer-checked:translate-x-4 peer-disabled:opacity-50" />
                        </label>
                    </div>

                    {error ? (
                        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                            {error}
                        </div>
                    ) : null}

                    <div className="flex gap-2 justify-end">
                        <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
                            {t('button.cancel')}
                        </Button>
                        <Button type="submit" disabled={!canFork} aria-busy={isPending} className="gap-2">
                            {isPending ? (
                                <>
                                    <Spinner size="sm" label={null} className="text-[var(--app-button-text)]" />
                                    {t('dialog.fork.confirming')}
                                </>
                            ) : (
                                t('dialog.fork.confirm')
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
