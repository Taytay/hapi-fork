import type { RpcHandlerManager } from '@/api/rpc/RpcHandlerManager';
import { logger } from '@/ui/logger';
import { getErrorMessage, rpcError } from '../rpcResponses';
import { type ListSkillsRequest, type ListSkillsResponse, listSkills } from '../skills';

export function registerSkillsHandlers(rpcHandlerManager: RpcHandlerManager): void {
    rpcHandlerManager.registerHandler<ListSkillsRequest, ListSkillsResponse>('listSkills', async () => {
        logger.debug('List skills request');

        try {
            const skills = await listSkills();
            return { success: true, skills };
        } catch (error) {
            logger.debug('Failed to list skills:', error);
            return rpcError(getErrorMessage(error, 'Failed to list skills'));
        }
    });
}
