import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const HAPI_BLOBS_DIR_NAME = 'hapi-blobs';

export function getHapiBlobsDir(): string {
    return join(tmpdir(), HAPI_BLOBS_DIR_NAME);
}
