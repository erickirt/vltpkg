import { error } from '@vltpkg/error-cause'
import { Spec } from '@vltpkg/spec/browser'
import type { SpecOptions } from '@vltpkg/spec/browser'
import type { Manifest } from '@vltpkg/types'

export const delimiter: Delimiter = '·'
export type Delimiter = '·'

/**
 * Dependency IDs are a URI-encoded set of strings, separated
 * by the {@link Delimiter} character (`'·'`).
 *
 * The first entry is always the specifier type. The rest depend on the
 * type. `git`, `registry`, and `workspace` entries have 3 fields, the rest
 * have 2.
 *
 * - `registry`: `'registry·<registry>·name@specifier'`
 *   The `<registry>` portion can be a known named registry name, or a
 *   url to a registry. If empty, it is the default registry. Examples:
 *   - `··some-package@2.0.1`
 *   - `·npm·whatever@1.2.3`
 *   - `·http%3A%2F%2Fvlt.sh%2F·x@1.2.3`
 * - `git`: `'git·<git remote>·<git selector>'`. For example:
 *   - `git·github:user/project·branchname`
 *   - `git·git%2Bssh%3A%2F%2Fuser%40host%3Aproject.git·semver:1.x`
 * - `workspace`: `'workspace·<path>'`. For example:
 *   - `workspace·src/mything`
 * - `remote`: `'remote·<url>'`
 * - `file`: `'file·<path>'`
 *
 * Lastly, the final portion can contain arbitrary string data, and is
 * used to store peer dep resolutions to maintain the peerDep contract.
 */
export type DepID =
  | `${'' | 'git'}${Delimiter}${string}${Delimiter}${string}${Delimiter}${string}`
  | `${'' | 'git'}${Delimiter}${string}${Delimiter}${string}`
  | `${'file' | 'remote' | 'workspace'}${Delimiter}${string}${Delimiter}${string}`
  | `${'file' | 'remote' | 'workspace'}${Delimiter}${string}`

/**
 * A {@link DepID}, split apart and URI-decoded
 */
export type DepIDTuple =
  | [
      type: 'git',
      gitRemote: string,
      gitSelector: string,
      extra?: string,
    ]
  | [
      type: 'registry',
      registry: string,
      registrySpec: string,
      extra?: string,
    ]
  | [type: 'file', path: string, extra?: string]
  | [type: 'remote', url: string, extra?: string]
  | [type: 'workspace', workspace: string, extra?: string]

const depIDRegExp = new RegExp(
  `^((git)?${delimiter}[^${delimiter}]*${delimiter}[^${delimiter}]*(${
    delimiter
  }[^${delimiter}]*)?$` +
    `|` +
    `^(file|remote|workspace)${delimiter}[^${
      delimiter
    }]*)(${delimiter}[^${delimiter}]*)?$`,
)

export const isDepID = (str: unknown): str is DepID =>
  typeof str === 'string' && depIDRegExp.test(str)

export const asDepID = (str: string): DepID => {
  if (!isDepID(str)) {
    throw error('Expected dep id', {
      found: str,
    })
  }
  return str
}

/**
 * turn a {@link DepIDTuple} into a {@link DepID}
 */
export const joinDepIDTuple = (list: DepIDTuple): DepID => {
  const [type, first, second, extra] = list
  const f = encode(first)
  switch (type) {
    case 'registry':
      return `${delimiter}${f}${delimiter}${encode(second)}${extra ? `${delimiter}${encode(extra)}` : ''}`
    case 'git':
      return `${type}${delimiter}${f}${delimiter}${encode(second)}${extra ? `${delimiter}${encode(extra)}` : ''}`
    default:
      return `${type}${delimiter}${f}${second ? `${delimiter}${encode(second)}` : ''}`
  }
}

// allow @, but otherwise, escape everything urls do
const encode = (s?: string) =>
  s ?
    encodeURIComponent(s)
      .replaceAll('%40', '@')
      .replaceAll('%2f', '§')
      .replaceAll('%2F', '§')
  : s

const decode = (s?: string) =>
  s ?
    decodeURIComponent(
      s.replaceAll('@', '%40').replaceAll('§', '%2F'),
    )
  : s

/**
 * turn a {@link DepID} into a {@link DepIDTuple}
 */
export const splitDepID = (id: string): DepIDTuple => {
  const [type, first = '', second, extra] = id
    .replaceAll('§', '/')
    .split(delimiter, 4)
  const f = decodeURIComponent(first)
  switch (type) {
    case 'git':
    case '': {
      if (second === undefined) {
        throw error(`invalid ${type} id`, { found: id })
      }
      const t: DepIDTuple = [
        type || 'registry',
        f,
        decodeURIComponent(second),
        decode(extra),
      ]
      return t
    }
    case 'file':
    case 'remote':
    case 'workspace': {
      const t: DepIDTuple = [type, f, decode(second)]
      return t
    }
    default: {
      throw error('invalid DepID type', {
        found: type,
        validOptions: ['git', 'file', 'workspace', 'remote', ''],
      })
    }
  }
}

/**
 * Retrieves the base {@link DepID} for a given depID,
 * ignoring any extra information that may be present.
 */
export const baseDepID = (id: string): DepID => {
  const [type, first, second] = splitDepID(id)
  switch (type) {
    case 'git':
    case 'registry':
      return joinDepIDTuple([type, first, second])
    default:
      return joinDepIDTuple([type, first])
  }
}

/**
 * Turn a {@link DepID} into a {@link Spec} object
 */
export const hydrate = (
  id: DepID,
  name?: string,
  options: SpecOptions = {},
): Spec => hydrateTuple(splitDepID(id), name, options)

/**
 * Turn a {@link DepIDTuple} into a {@link Spec} object
 */
export const hydrateTuple = (
  tuple: DepIDTuple,
  name?: string,
  options: SpecOptions = {},
) => {
  const [type, first, second] = tuple
  switch (type) {
    case 'remote': {
      if (!first)
        throw error('no remoteURL found on remote id', {
          found: tuple,
        })
      return Spec.parse(name ?? '(unknown)', first)
    }
    case 'file': {
      if (!first) {
        throw error('no file path found on remote id', {
          found: tuple,
        })
      }
      return Spec.parse(name ?? '(unknown)', `file:${first}`, options)
    }
    case 'registry': {
      if (typeof first !== 'string') {
        throw error('no registry url or name in registry ID', {
          found: tuple,
        })
      }
      if (!second) {
        throw error('no name/specifier in registry ID', {
          found: tuple,
        })
      }
      if (!first) {
        // just a normal name@version on the default registry
        const s = Spec.parse(second)
        if (name && s.name !== name) {
          return Spec.parse(`${name}@npm:${second}`)
        } else {
          return s
        }
      }
      if (!/^https?:\/\//.test(first)) {
        const reg = options.registries?.[first]
        if (first !== 'npm' && !reg) {
          throw error('named registry not found in options', {
            name: first,
            found: tuple,
          })
        }
        return Spec.parse(
          name ?? '(unknown)',
          `${first}:${second}`,
          options,
        )
      }
      const s = Spec.parse(
        name ?? '(unknown)',
        `registry:${first}#${second}`,
        options,
      )
      return name && s.final.name !== name ?
          Spec.parse(s.final.name + '@' + s.bareSpec)
        : s
    }
    case 'git': {
      if (!first) {
        throw error('no git remote in git ID', {
          found: tuple,
        })
      }
      return Spec.parse(
        name ?? '(unknown)',
        first + '#' + second,
        options,
      )
    }
    case 'workspace': {
      if (!first) {
        throw error('no name/path on workspace id', { found: tuple })
      }
      return name && name !== first ?
          Spec.parse(name, `workspace:${first}@*`, options)
        : Spec.parse(first, `workspace:*`, options)
    }
  }
}

// Strip out the default registry, there's no need to store that
const omitDefReg = (s?: string): string =>
  (
    !s ||
    s === 'https://registry.npmjs.org' ||
    s === 'https://registry.npmjs.org/'
  ) ?
    ''
  : s

/**
 * Get the {@link DepIDTuple} for a given {@link Spec} and {@link Manifest}.
 * The Manifest is used to get the name and version, if possible. If not found
 * in the manifest, registry ID types will use the name or bareSpec from the
 * specifier, so at least there's something to use later.
 */
export const getTuple = (
  spec: Spec,
  mani: Manifest,
  extra?: string,
): DepIDTuple => {
  const f = spec.final
  switch (f.type) {
    case 'registry': {
      // try to shorten to a known name if we can.
      const reg = omitDefReg(f.registry)
      if (!f.namedRegistry && reg) {
        for (const [alias, host] of Object.entries(
          spec.options.registries,
        )) {
          if (reg === host) {
            f.namedRegistry = alias
            break
          }
        }
      }
      const version =
        mani.version ?
          mani.version.startsWith('v') ?
            mani.version.slice(1)
          : mani.version
        : f.bareSpec
      return [
        f.type,
        f.namedRegistry ?? reg,
        `${isPackageNameConfused(spec, mani.name) ? spec.name : (mani.name ?? f.name)}@${version}`,
        extra,
      ]
    }
    case 'git': {
      const {
        namedGitHost,
        namedGitHostPath,
        gitRemote,
        gitSelector = '',
      } = f
      if (!gitRemote)
        throw error('no host on git specifier', { spec })
      if (namedGitHost) {
        if (!namedGitHostPath) {
          throw error('named git host without path portion', {
            spec,
          })
        }
        return [
          f.type,
          `${namedGitHost}:${namedGitHostPath}`,
          gitSelector,
          extra,
        ]
      } else {
        return [f.type, gitRemote, gitSelector, extra]
      }
    }
    case 'remote': {
      const { remoteURL } = f
      if (!remoteURL)
        throw error('no URL on remote specifier', { spec })
      return [f.type, remoteURL, extra]
    }
    case 'file':
    case 'workspace':
      throw error('Path-based dep ids are not supported', { spec })
  }
}

/**
 * Checks for a potentially manifest-confused package name.
 * Returns `true` if the package name is confused, `false` otherwise.
 */
export const isPackageNameConfused = (spec?: Spec, name?: string) =>
  !!spec?.name && // a nameless spec can't be checked
  !spec.subspec && // it's not an aliased package or using a custom protocol
  spec.type === 'registry' && // the defined spec is of type registry
  spec.name !== name // its name is not the same as the defined spec name

/**
 * Get the {@link DepID} for a given {@link Spec} and {@link Manifest}. The
 * Manifest is used to get the name and version, if possible. If not found in
 * the manifest, registry ID types will use the name or bareSpec from the
 * specifier, so at least there's something to use later.
 */
export const getId = (
  spec: Spec,
  mani: Manifest,
  extra?: string,
): DepID => joinDepIDTuple(getTuple(spec, mani, extra))
