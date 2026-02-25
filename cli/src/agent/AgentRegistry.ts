import type { AgentBackend, AgentBackendFactory } from './types';

export class AgentRegistry {
    private static readonly factories = new Map<string, AgentBackendFactory>();

    static register(agentType: string, factory: AgentBackendFactory): void {
        if (!agentType || typeof agentType !== 'string') {
            throw new Error('Agent type must be a non-empty string');
        }
        AgentRegistry.factories.set(agentType, factory);
    }

    static create(agentType: string): AgentBackend {
        const factory = AgentRegistry.factories.get(agentType);
        if (!factory) {
            throw new Error(`Unknown agent type: ${agentType}`);
        }
        return factory();
    }

    static list(): string[] {
        return Array.from(AgentRegistry.factories.keys()).sort();
    }
}
