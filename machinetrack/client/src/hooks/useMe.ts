import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useMe() {
  const { data, isLoading, error } = useQuery<User>({
    queryKey: ["/api/me"],
    retry: false,
  });
  return { user: data ?? null, loading: isLoading, error };
}
