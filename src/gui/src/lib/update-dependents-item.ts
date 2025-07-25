import type React from 'react'
import type { OnDependentClickOptions } from '@/components/explorer-grid/overview-sidebar/index.tsx'
import type { GridItemData } from '@/components/explorer-grid/types'

export type UpdateDependentsItemOptions = {
  /**
   * The current query string.
   */
  query: string
  /**
   * The zustand-store query update function.
   */
  updateQuery: (query: string) => void
}

/**
 * Checks if a given query ends with a child reference.
 */
const endsWithChildRef = (
  query: string,
  item: GridItemData,
  checkParenthesis?: boolean,
): boolean => {
  const possibleIDSelectorNames = new Set<string>()
  for (const edge of item.to?.edgesIn ?? []) {
    possibleIDSelectorNames.add(edge.name)
  }
  const childManifestName =
    item.to?.manifest?.name ? `[name=${item.to.manifest.name}]` : ''
  const childVersion =
    item.to?.version ? `:v(${item.to.version})` : ''
  for (const name of possibleIDSelectorNames) {
    const hasIDSelectorAndVersion = query.endsWith(
      `> #${name}${childVersion}` + (checkParenthesis ? ')' : ''),
    )
    const hasIDSelectorNoVersion = query.endsWith(
      `> #${name}` + (checkParenthesis ? ')' : ''),
    )
    const hasManifestNameAndVersion = query.endsWith(
      `> ${childManifestName}${childVersion}` +
        (checkParenthesis ? ')' : ''),
    )
    const hasManifestNameNoVersion = query.endsWith(
      `> ${childManifestName}` + (checkParenthesis ? ')' : ''),
    )
    if (
      hasIDSelectorAndVersion ||
      hasIDSelectorNoVersion ||
      hasManifestNameAndVersion ||
      hasManifestNameNoVersion
    ) {
      return true
    }
  }
  return false
}

/**
 * Gets the unique ID selector name from the item if available.
 */
const getIDSelectorName = (
  item: GridItemData,
): string | undefined => {
  let idSelectorName: string | undefined
  for (const edge of item.from?.edgesIn ?? []) {
    // if the id selector name has been already seen
    // we just drop it and break, we can't use it since
    // the target node has multiple edge names
    if (idSelectorName && idSelectorName !== edge.name) {
      idSelectorName = undefined
      break
    }
    // we set the first seen edge as the selector name
    idSelectorName = edge.name
  }
  return idSelectorName
}

/**
 * Appends a self-reference to the query if it does not already exist.
 */
const appendSelfRef = (query: string, item: GridItemData): string => {
  const idSelectorName = getIDSelectorName(item)
  const manifestName = item.from?.name
  const missingIDSelectorName =
    idSelectorName ? !query.includes(idSelectorName) : true
  const missingManifestName =
    manifestName ? !query.includes(manifestName) : true
  if (missingIDSelectorName && missingManifestName) {
    if (idSelectorName) {
      return `${query}:is(#${idSelectorName})`
    }
    if (manifestName) {
      return `${query}:is([name=${manifestName}])`
    }
  }
  return query
}

/**
 * Check if the from item is a direct root dependency.
 */
const isFromDirectRootDep = (item: GridItemData): boolean => {
  if (item.from?.edgesIn.size) {
    for (const edge of item.from.edgesIn) {
      if (edge.from.mainImporter) {
        return true
      }
    }
  }
  return false
}

/**
 * Check if the from item is a direct workspace dependency.
 */
const isFromDirectWorkspaceDep = (item: GridItemData): boolean => {
  if (item.from?.edgesIn.size) {
    for (const edge of item.from.edgesIn) {
      if (edge.from.importer) {
        return true
      }
    }
  }
  return false
}

/**
 * Gets the name of the direct workspace dependency if available.
 */
const getFromDirectWorkspaceDepName = (
  item: GridItemData,
): string | undefined => {
  if (item.from?.edgesIn.size) {
    for (const edge of item.from.edgesIn) {
      if (edge.from.importer && edge.from.name) {
        return edge.from.name
      }
    }
  }
  return undefined
}

/**
 * Updates the query based on a given dependents item.
 */
export const updateDependentsItem =
  ({ query, updateQuery }: UpdateDependentsItemOptions) =>
  ({ item, isParent }: OnDependentClickOptions) =>
  (e: React.MouseEvent | MouseEvent) => {
    e.preventDefault()

    // wrap around :has selector to try and select its parent
    if (!item.from) {
      updateQuery(`:has(${query})`)
      return
    }

    // If the item points to a mainImporter, navigate to root
    if (item.from.mainImporter) {
      updateQuery(`:root`)
      return
    }

    // If the item is a workspace, use the :workspace selector
    if (item.from.importer && item.from.name) {
      updateQuery(`#${item.from.name}:workspace`)
      return
    }

    // Handle basic parent navigation by removing the
    // last part of the query if it matches common patterns
    const trimmedQuery = query.trim()
    if (isParent) {
      // id selectors are edge-based, so here we only get an id selector name
      // if the target node has a single name across all its edges in,
      // that's not going to be the case, for example, for aliased packages
      if (endsWithChildRef(trimmedQuery, item)) {
        updateQuery(
          appendSelfRef(
            query.slice(0, query.lastIndexOf('>')).trim(),
            item,
          ),
        )
        return
      }
      // when ending with a parentesis, it's should be mostly the same
      // it may be the case to queries with appended :is(#parent > #child)
      // selectors from search result
      if (endsWithChildRef(trimmedQuery, item, true)) {
        updateQuery(
          appendSelfRef(
            query.slice(0, query.lastIndexOf('>')).trim() + ')',
            item,
          ),
        )
        return
      }
    }

    // preppends selectors if it's a direct importer dependency
    const prefix =
      isFromDirectRootDep(item) ? ':root > '
      : isFromDirectWorkspaceDep(item) ?
        `#${getFromDirectWorkspaceDepName(item)}:workspace > `
      : ''
    const idSelectorName = getIDSelectorName(item)
    const destName = item.from.name || ''
    const graph = item.from.graph
    const uniqueNodeName = graph.nodesByName.get(destName)?.size === 1
    // prefer using an id selector name if possible, otherwise anchors
    // on the manifest package name
    const name =
      idSelectorName ? `#${idSelectorName}`
      : item.from.name ? `[name=${item.from.name}]`
      : ''
    // append a version if needed to help desimbiguate
    const version =
      !uniqueNodeName && item.from.version ?
        `:v(${item.from.version})`
      : ''
    updateQuery(`${prefix}${name}${version}`)
  }
