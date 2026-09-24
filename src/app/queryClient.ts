import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      // Focus refetch is the specific thing that silently drains NewsAPI's 100 requests/day:
      // every tab switch would re-fan-out to all three sources. Keep this off.
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
