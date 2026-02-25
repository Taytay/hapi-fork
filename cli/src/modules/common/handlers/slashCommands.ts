import type { RpcHandlerManager } from '@/api/rpc/RpcHandlerManager';
import { logger } from '@/ui/logger';
import { getErrorMessage, rpcError } from '../rpcResponses';
import { type ListSlashCommandsRequest, type ListSlashCommandsResponse, listSlashCommands } from '../slashCommands';

export function registerSlashCommandHandlers(rpcHandlerManager: RpcHandlerManager): void {
    rpcHandlerManager.registerHandler<ListSlashCommandsRequest, ListSlashCommandsResponse>(
        'listSlashCommands',
        async (data) => {
            logger.debug('List slash commands request for agent:', data.agent);

            try {
                const commands = await listSlashCommands(data.agent);
                return { success: true, commands };
            } catch (error) {
                logger.debug('Failed to list slash commands:', error);
                return rpcError(getErrorMessage(error, 'Failed to list slash commands'));
            }
        },
    );
}
