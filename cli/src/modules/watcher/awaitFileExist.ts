import { access } from 'node:fs/promises';
import { delay } from '@/utils/time';

export async function awaitFileExist(file: string, timeout: number = 10000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        try {
            await access(file);
            return true;
        } catch (_e) {
            await delay(1000);
        }
    }
    return false;
}
