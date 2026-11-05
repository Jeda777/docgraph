export const USERS_QUERY_KEY = ['users']

export const PROJECTS_QUERY_KEY = ['projects']
export const PROJECT_DETAIL_QUERY_KEY = (projectId: string) => [...PROJECTS_QUERY_KEY, projectId]

export const ITEMS_QUERY_KEY = ['items']
export const ITEM_DETAIL_QUERY_KEY = (itemId: string) => [...ITEMS_QUERY_KEY, itemId]

export const API_KEYS_QUERY_KEY = ['api-keys']

export const ACCOUNTS_QUERY_KEY = ['accounts']
