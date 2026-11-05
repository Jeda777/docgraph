import type {
  UserCreateInput,
  UserGetListOutput,
  UserUpdateInput,
  UserUpdateOutput,
} from '@docgraph/common/schemas'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import { PROJECTS_QUERY_KEY, USERS_QUERY_KEY } from './query-keys'

export const useUserGetList = (enabled = true) => {
  return useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: async () => {
      const res = await api.get<UserGetListOutput>('/users')
      return res.data
    },
    enabled,
  })
}

export const useUserCreate = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: UserCreateInput) => {
      await api.post('/users', data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY })
    },
  })
}

/** Promotes or demotes a user (admins only); nobody can change their own role, so an admin always remains. */
export const useUserUpdate = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: UserUpdateInput & { id: string }) => {
      const res = await api.patch<UserUpdateOutput>(`/users/${id}`, data)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY })
    },
  })
}

/** Deletes a user with their sessions, API keys and project memberships (admins only). */
export const useUserDelete = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY })
      // Project member lists drop the user.
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY })
    },
  })
}
