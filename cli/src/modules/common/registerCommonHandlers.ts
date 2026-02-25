import type { RpcHandlerManager } from '@/api/rpc/RpcHandlerManager';
import { registerBashHandlers } from './handlers/bash';
import { registerDifftasticHandlers } from './handlers/difftastic';
import { registerDirectoryHandlers } from './handlers/directories';
import { registerFileHandlers } from './handlers/files';
import { registerGitHandlers } from './handlers/git';
import { registerRipgrepHandlers } from './handlers/ripgrep';
import { registerSkillsHandlers } from './handlers/skills';
import { registerSlashCommandHandlers } from './handlers/slashCommands';
import { registerUploadHandlers } from './handlers/uploads';

export function registerCommonHandlers(rpcHandlerManager: RpcHandlerManager, workingDirectory: string): void {
    registerBashHandlers(rpcHandlerManager, workingDirectory);
    registerFileHandlers(rpcHandlerManager, workingDirectory);
    registerDirectoryHandlers(rpcHandlerManager, workingDirectory);
    registerRipgrepHandlers(rpcHandlerManager, workingDirectory);
    registerDifftasticHandlers(rpcHandlerManager, workingDirectory);
    registerSlashCommandHandlers(rpcHandlerManager);
    registerSkillsHandlers(rpcHandlerManager);
    registerGitHandlers(rpcHandlerManager, workingDirectory);
    registerUploadHandlers(rpcHandlerManager);
}
