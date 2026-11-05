import type { ItemCreateInput, ItemOutput, ItemUpdateInput } from '@docgraph/common/schemas'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import { ITEM_DETAIL_QUERY_KEY, PROJECT_DETAIL_QUERY_KEY } from './query-keys'

/** Items are listed only in their project's details, so every item change refreshes those. */
const useInvalidateProjectItems = () => {
  const queryClient = useQueryClient()
  return (projectId: string) =>
    queryClient.invalidateQueries({ queryKey: PROJECT_DETAIL_QUERY_KEY(projectId) })
}

export const useItemCreate = () => {
  const invalidateProjectItems = useInvalidateProjectItems()
  return useMutation({
    mutationFn: async (data: ItemCreateInput) => {
      const res = await api.post<ItemOutput>('/items', data)
      return res.data
    },
    onSuccess: (item) => invalidateProjectItems(item.projectId),
  })
}

export const useItemGetById = (id: string, enabled = true) => {
  return useQuery({
    queryKey: ITEM_DETAIL_QUERY_KEY(id),
    queryFn: async () => {
      const res = await api.get<ItemOutput>(`/items/${id}`)
      return res.data
    },
    enabled,
  })
}

export const useItemUpdate = () => {
  const queryClient = useQueryClient()
  const invalidateProjectItems = useInvalidateProjectItems()
  return useMutation({
    mutationFn: async ({ id, ...data }: ItemUpdateInput & { id: string }) => {
      const res = await api.patch<ItemOutput>(`/items/${id}`, data)
      return res.data
    },
    onSuccess: (item) => {
      queryClient.setQueryData(ITEM_DETAIL_QUERY_KEY(item.id), item)
      return invalidateProjectItems(item.projectId)
    },
  })
}

export const useItemDelete = () => {
  const queryClient = useQueryClient()
  const invalidateProjectItems = useInvalidateProjectItems()
  return useMutation({
    mutationFn: async ({ id }: Pick<ItemOutput, 'id' | 'projectId'>) => {
      await api.delete(`/items/${id}`)
    },
    onSuccess: (_, { id, projectId }) => {
      // Removed rather than invalidated: refetching a deleted item would only get a 404.
      queryClient.removeQueries({ queryKey: ITEM_DETAIL_QUERY_KEY(id) })
      return invalidateProjectItems(projectId)
    },
  })
}
