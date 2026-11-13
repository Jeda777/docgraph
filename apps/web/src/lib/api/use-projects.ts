import type {
  ProjectCreateInput,
  ProjectCreateOutput,
  ProjectGetByIdInput,
  ProjectGetByIdOutput,
  ProjectGetListOutput,
  ProjectUpdateInput,
  ProjectUpdateOutput,
} from '@docgraph/common/schemas'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import { ITEMS_QUERY_KEY, PROJECT_DETAIL_QUERY_KEY, PROJECTS_QUERY_KEY } from './query-keys'

export const useProjectGetList = (enabled = true) => {
  return useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: async () => {
      const res = await api.get<ProjectGetListOutput>('/projects')
      return res.data
    },
    enabled,
  })
}

export const useProjectGetById = (id: string, params: ProjectGetByIdInput = {}, enabled = true) => {
  return useQuery({
    queryKey: [...PROJECT_DETAIL_QUERY_KEY(id), params],
    queryFn: async () => {
      const res = await api.get<ProjectGetByIdOutput>(`/projects/${id}`, { params })
      return res.data
    },
    enabled,
  })
}

export const useProjectUpdate = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: ProjectUpdateInput & { id: string }) => {
      const res = await api.patch<ProjectUpdateOutput>(`/projects/${id}`, data)
      return res.data
    },
    onSuccess: (_, { id }) => {
      // Invalidated rather than set from the response: the cached details also hold members
      // and items, which the response lacks and the update may change. The prefix covers every
      // `params` variant of this project's details; other projects don't change.
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: PROJECT_DETAIL_QUERY_KEY(id) }),
        queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY, exact: true }),
      ])
    },
  })
}

export const useProjectCreate = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: ProjectCreateInput) => {
      const res = await api.post<ProjectCreateOutput>('/projects', data)
      return res.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY, exact: true }),
  })
}

export const useProjectDelete = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/projects/${id}`)
    },
    onSuccess: (_, id) => {
      // Removed rather than invalidated: refetching a deleted project would only get a 404.
      queryClient.removeQueries({ queryKey: PROJECT_DETAIL_QUERY_KEY(id) })
      // Its items went with it, and the client can't tell which cached items were its own.
      queryClient.removeQueries({ queryKey: ITEMS_QUERY_KEY })
      // Other projects' details don't change, so only the list is refetched.
      return queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY, exact: true })
    },
  })
}
