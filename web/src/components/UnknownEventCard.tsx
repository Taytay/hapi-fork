import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { CodeBlock } from '@/components/CodeBlock'

function EventIcon() {
    return (
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="11" r="0.75" fill="currentColor" />
        </svg>
    )
}

function DetailsIcon() {
    return (
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
            <path
                d="M6 3l5 5-5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}

export function UnknownEventCard(props: { title: string; rawJson?: string }) {
    const { title, rawJson } = props

    if (!rawJson) {
        return (
            <div className="py-1">
                <div className="mx-auto w-fit max-w-[92%] px-2 text-center text-xs text-[var(--app-hint)] opacity-80">
                    <span className="inline-flex items-center gap-1">
                        <span aria-hidden="true">
                            <EventIcon />
                        </span>
                        <span>{title}</span>
                    </span>
                </div>
            </div>
        )
    }

    return (
        <Card className="min-w-0 max-w-full overflow-hidden shadow-sm">
            <CardHeader className="p-3 space-y-0">
                <Dialog>
                    <DialogTrigger asChild>
                        <button type="button" className="w-full text-left">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 flex items-center gap-2">
                                    <div className="shrink-0 flex h-4 w-4 items-center justify-center text-[var(--app-hint)] leading-none">
                                        <EventIcon />
                                    </div>
                                    <CardTitle className="min-w-0 text-sm font-medium leading-tight break-words text-[var(--app-hint)]">
                                        {title}
                                    </CardTitle>
                                </div>
                                <span className="text-[var(--app-hint)]">
                                    <DetailsIcon />
                                </span>
                            </div>
                        </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>{title}</DialogTitle>
                        </DialogHeader>
                        <div className="mt-3 max-h-[75vh] overflow-auto">
                            <CodeBlock code={rawJson} language="json" />
                        </div>
                    </DialogContent>
                </Dialog>
            </CardHeader>
        </Card>
    )
}
