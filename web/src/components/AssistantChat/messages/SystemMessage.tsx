import { useAssistantState } from '@assistant-ui/react'
import { getEventPresentation } from '@/chat/presentation'
import type { HappyChatMessageMetadata } from '@/lib/assistant-runtime'
import { UnknownEventCard } from '@/components/UnknownEventCard'

export function HappySystemMessage() {
    const role = useAssistantState(({ message }) => message.role)
    const text = useAssistantState(({ message }) => {
        if (message.role !== 'system') return ''
        return message.content[0]?.type === 'text' ? message.content[0].text : ''
    })
    const icon = useAssistantState(({ message }) => {
        if (message.role !== 'system') return null
        const custom = message.metadata.custom as Partial<HappyChatMessageMetadata> | undefined
        const event = custom?.kind === 'event' ? custom.event : undefined
        return event ? getEventPresentation(event).icon : null
    })
    const unknownEventData = useAssistantState(({ message }) => {
        if (message.role !== 'system') return null
        const custom = message.metadata.custom as Partial<HappyChatMessageMetadata> | undefined
        const event = custom?.kind === 'event' ? custom.event : undefined
        if (!event) return null
        const presentation = getEventPresentation(event)
        if (!presentation.isUnknown) return null
        return { title: presentation.text, rawJson: presentation.rawJson }
    })

    if (role !== 'system') return null

    if (unknownEventData) {
        return (
            <div className="py-1 mx-auto w-full max-w-[92%]">
                <UnknownEventCard title={unknownEventData.title} rawJson={unknownEventData.rawJson} />
            </div>
        )
    }

    return (
        <div className="py-1">
            <div className="mx-auto w-fit max-w-[92%] px-2 text-center text-xs text-[var(--app-hint)] opacity-80">
                <span className="inline-flex items-center gap-1">
                    {icon ? <span aria-hidden="true">{icon}</span> : null}
                    <span>{text}</span>
                </span>
            </div>
        </div>
    )
}
