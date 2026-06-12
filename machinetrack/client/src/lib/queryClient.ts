import { QueryClient } from "@tanstack/react-query";
import { api } from "./api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const url = queryKey[0] as string;
        return api(url);
      },
      retry: false,
      staleTime: 30_000,
    },
  },
});
