import { useQuery } from '@tanstack/react-query';
import type { ApiClient } from '@/api/client';
import { queryKeys } from '@/lib/query-keys';
import type { SessionSummary } from '@/types/api';

export function useSessions(api: ApiClient | null): {
    sessions: SessionSummary[];
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<unknown>;
} {
    const query = useQuery({
        queryKey: queryKeys.sessions,
        queryFn: async () => {
            if (!api) {
                throw new Error('API unavailable');
            }
            return await api.getSessions();
        },
        enabled: Boolean(api),
    });

    return {
        sessions: query.data?.sessions ?? [],
        isLoading: query.isLoading,
        error: query.error instanceof Error ? query.error.message : query.error ? 'Failed to load sessions' : null,
        refetch: query.refetch,
    };
}
