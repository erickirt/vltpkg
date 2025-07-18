import { create } from 'zustand'
import { decodeCompressedQuery } from '@/lib/compress-query.ts'
import type {
  State,
  Action,
  SavedQuery,
  QueryLabel,
} from './types.ts'

export const DEFAULT_QUERY = ':root'

const DEFAULT_QUERY_LABELS: QueryLabel[] = [
  {
    id: '8c79bb69-164b-420a-813a-c2e5d3b196e6',
    color: '#06b6d4',
    name: 'Outdated',
    description: 'Dependencies that are out of date',
  },
  {
    id: '4859e408-3d4c-4773-85c6-87e63ad763cd',
    color: '#eab308',
    name: 'Unstable',
    description: 'Dependencies that are buggy',
  },
  {
    id: 'c70add9d-989a-49cd-9e58-42e63459764b',
    color: '#ef4444',
    name: 'Insecure',
    description: 'Dependencies with vulnerability issues',
  },
]

const newStamp = () => String(Math.random()).slice(2)

const getInitialQuery = (): string => {
  if (typeof window === 'undefined') {
    return DEFAULT_QUERY
  }

  const currentPath = window.location.pathname
  if (currentPath.startsWith('/explore/')) {
    const pathSegments = currentPath.split('/')
    const compressedQuery = pathSegments[2]

    if (compressedQuery) {
      try {
        return decodeCompressedQuery(compressedQuery)
      } catch (error) {
        console.error('Failed to decode compressed query:', error)
      }
    }
  }

  return DEFAULT_QUERY
}

const initialState: State = {
  appData: undefined,
  dashboard: undefined,
  graph: undefined,
  edges: [],
  errorCause: '',
  hasDashboard: false,
  nodes: [],
  projectInfo: {
    tools: [],
    vltInstalled: undefined,
  },
  query: getInitialQuery(),
  q: undefined,
  specOptions: undefined,
  stamp: newStamp(),
  theme: localStorage.getItem('vite-ui-theme') as State['theme'],
  focused: JSON.parse(
    localStorage.getItem('focused') ?? 'false',
  ) as boolean,
  savedQueries: JSON.parse(
    localStorage.getItem('saved-queries') || '[]',
  ) as State['savedQueries'],
  savedQueryLabels: (() => {
    const storedLabels = localStorage.getItem('query-labels')
    if (storedLabels) {
      const parsed = JSON.parse(storedLabels) as QueryLabel[]
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
    const defaultLabels = [...DEFAULT_QUERY_LABELS]
    localStorage.setItem(
      'query-labels',
      JSON.stringify(defaultLabels),
    )
    return defaultLabels
  })(),
}

/**
 * Mostly glue code from Zustand to make the store available
 * to the rest of the app. Also defines a few useful default
 * values and integrates with browser history.
 */
export const useGraphStore = create<Action & State>((set, get) => {
  const store = {
    ...initialState,
    updateAppData: (appData: State['appData']) =>
      set(() => ({ appData })),
    updateDashboard: (dashboard: State['dashboard']) =>
      set(() => ({ dashboard })),
    updateGraph: (graph: State['graph']) => set(() => ({ graph })),
    updateQ: (q: State['q']) => set(() => ({ q })),
    updateQuery: (query: State['query']) => set(() => ({ query })),
    updateEdges: (edges: State['edges']) => set(() => ({ edges })),
    updateErrorCause: (errorCause: State['errorCause']) =>
      set(() => ({ errorCause })),
    updateHasDashboard: (hasDashboard: State['hasDashboard']) =>
      set(() => ({ hasDashboard })),
    updateNodes: (nodes: State['nodes']) => set(() => ({ nodes })),
    updateProjectInfo: (projectInfo: State['projectInfo']) =>
      set(() => ({ projectInfo })),
    updateSpecOptions: (specOptions: State['specOptions']) =>
      set(() => ({ specOptions })),
    updateStamp: () => set(() => ({ stamp: newStamp() })),
    updateTheme: (theme: State['theme']) => set(() => ({ theme })),
    updateFocused: (focused: State['focused']) => {
      set(() => ({ focused }))
      localStorage.setItem('focused', JSON.stringify(focused))
    },
    reset: () => set(initialState),
    updateSavedQuery: (updatedItem: SavedQuery) => {
      const savedQueries = get().savedQueries ?? []

      const updatedQueries = savedQueries.map(savedQuery =>
        savedQuery.id === updatedItem.id ? updatedItem : savedQuery,
      )

      set({ savedQueries: updatedQueries })
      localStorage.setItem(
        'saved-queries',
        JSON.stringify(updatedQueries),
      )
    },
    saveQuery: (item: SavedQuery) => {
      const savedQueries = get().savedQueries ?? []
      let updatedQueries = [...savedQueries]
      const isQuerySaved = updatedQueries.find(
        savedQuery => savedQuery.id === item.id,
      )

      if (!isQuerySaved) {
        updatedQueries.push(item)
      } else {
        updatedQueries = updatedQueries.filter(
          savedQuery => savedQuery.id !== item.id,
        )
      }

      set({ savedQueries: updatedQueries })
      localStorage.setItem(
        'saved-queries',
        JSON.stringify(updatedQueries),
      )
    },
    deleteSavedQueries: (queries: SavedQuery[]) => {
      const savedQueries = get().savedQueries ?? []

      const queryIds = queries.map(query => query.id)
      const updatedQueries = savedQueries.filter(
        savedQuery => !queryIds.includes(savedQuery.id),
      )

      set({ savedQueries: updatedQueries })
      localStorage.setItem(
        'saved-queries',
        JSON.stringify(updatedQueries),
      )
    },
    saveQueryLabel: (queryLabel: QueryLabel) => {
      const savedQueryLabels = get().savedQueryLabels ?? []
      let updatedQueryLabels = [...savedQueryLabels]
      const isQueryLabelSaved = updatedQueryLabels.find(
        savedQueryLabel => savedQueryLabel.id === queryLabel.id,
      )

      if (!isQueryLabelSaved) {
        updatedQueryLabels.push(queryLabel)
      } else {
        updatedQueryLabels = updatedQueryLabels.filter(
          savedQueryLabel => savedQueryLabel.id !== queryLabel.id,
        )
      }

      set({ savedQueryLabels: updatedQueryLabels })
      localStorage.setItem(
        'query-labels',
        JSON.stringify(updatedQueryLabels),
      )
    },
    updateSavedQueryLabel: (updatedItem: QueryLabel) => {
      const savedLabels = get().savedQueryLabels ?? []
      const savedQueries = get().savedQueries ?? []

      const updatedLabels = savedLabels.map(savedLabel =>
        savedLabel.id === updatedItem.id ? updatedItem : savedLabel,
      )

      const updatedQueries = savedQueries.map(savedQuery => {
        if (savedQuery.labels) {
          const updatedLabelsForQuery = savedQuery.labels.map(
            label =>
              label.id === updatedItem.id ? updatedItem : label,
          )
          return {
            ...savedQuery,
            labels: updatedLabelsForQuery,
            dateModified: new Date().toISOString(),
          }
        }
        return savedQuery
      })

      set({
        savedQueryLabels: updatedLabels,
        savedQueries: updatedQueries,
      })

      localStorage.setItem(
        'query-labels',
        JSON.stringify(updatedLabels),
      )
      localStorage.setItem(
        'saved-queries',
        JSON.stringify(updatedQueries),
      )
    },
    deleteSavedQueryLabels: (queryLabels: QueryLabel[]) => {
      const savedLabels = get().savedQueryLabels ?? []
      const savedQueries = get().savedQueries ?? []

      const queryLabelIdsToDelete = queryLabels.map(label => label.id)

      const updatedLabels = savedLabels.filter(
        label => !queryLabelIdsToDelete.includes(label.id),
      )

      const updatedQueries = savedQueries.map(savedQuery => {
        if (savedQuery.labels) {
          const filteredLabels = savedQuery.labels.filter(
            label => !queryLabelIdsToDelete.includes(label.id),
          )
          return {
            ...savedQuery,
            labels: filteredLabels,
            dateModified: new Date().toISOString(),
          }
        }
        return savedQuery
      })

      set({
        savedQueryLabels: updatedLabels,
        savedQueries: updatedQueries,
      })

      localStorage.setItem(
        'query-labels',
        JSON.stringify(updatedLabels),
      )
      localStorage.setItem(
        'saved-queries',
        JSON.stringify(updatedQueries),
      )
    },
  }

  return store
})
