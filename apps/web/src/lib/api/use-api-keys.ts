import type {
  ApiKey,
  ApiKeyCreateInput,
  ApiKeyCreateOutput,
  ApiKeyGetListOutput,
} from '@docgraph/common/schemas'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authClient } from './auth'
import { API_KEYS_QUERY_KEY } from './query-keys'

/** An API key record as the Better Auth client returns it. */
type PluginApiKey = Awaited<ReturnType<typeof authClient.apiKey.list>>['apiKeys'][number]

/** Better Auth's API key record in the shape the UI works with. */
const toApiKey = (key: PluginApiKey): ApiKey => ({
  id: key.id,
  name: key.name ?? '',
  createdAt: new Date(key.createdAt),
  lastUsedAt: key.lastRequest ? new Date(key.lastRequest) : null,
})

export const useApiKeyGetList = (enabled = true) => {
  return useQuery({
    queryKey: API_KEYS_QUERY_KEY,
    queryFn: async (): Promise<ApiKeyGetListOutput> => {
      const { apiKeys } = await authClient.apiKey.list()
      return apiKeys.map(toApiKey)
    },
    enabled,
  })
}

export const useApiKeyCreate = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name }: ApiKeyCreateInput): Promise<ApiKeyCreateOutput> => {
      const created = await authClient.apiKey.create({ name })
      return { ...toApiKey(created), key: created.key }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: API_KEYS_QUERY_KEY })
    },
  })
}

export const useApiKeyDelete = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await authClient.apiKey.delete({ keyId: id })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: API_KEYS_QUERY_KEY })
    },
  })
}
