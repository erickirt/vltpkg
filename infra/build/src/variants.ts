import { posix, win32 } from 'node:path'
import { rm } from 'node:fs/promises'
import { bundle } from './bundle.ts'
import { compile } from './compile.ts'
import { BINS } from './bins.ts'
import type { Bin } from './bins.ts'

export const VARIANTS = ['Node', 'Bundle', 'Compile'] as const

// Changing this will change which variant is published as `vlt` on npm.
export const PUBLISHED_VARIANT: 'Bundle' | 'Compile' = 'Bundle'

export const VARIANT_VALUES = {
  Node: 'Node',
  Bundle: 'Bundle',
  Compile: 'Compile',
} as const satisfies Record<Variant, Variant>

export const isVariant = (value: unknown): value is Variant =>
  VARIANTS.includes(value as Variant)

export type Variant = (typeof VARIANTS)[number]

export type VariantOptions = {
  args: (bin: Bin) => string[]
  PATH?: string
  env?: Record<string, string>
}

// Deno variants use the same artifacts as the Node variants
export type ArtifactKey = Exclude<Variant, `Deno${string}`>

export type Artifact = {
  dir: string
  bin: (bin: Bin) => string
  prepare?: () => Promise<unknown>
  cleanup?: () => Promise<unknown>
}

export type VariantWithArtifact = VariantOptions & {
  artifact: Artifact
}

export const createArtifacts = ({
  dirs,
  bins = BINS,
  windows = process.platform === 'win32',
  cleanup = true,
}: {
  dirs: Record<ArtifactKey, string>
  bins?: readonly Bin[]
  windows?: boolean
  cleanup?: boolean
}): Record<ArtifactKey, Artifact> => {
  const path = windows ? win32 : posix
  const createCleanup = (dir: string) =>
    cleanup ?
      () => rm(dir, { recursive: true, force: true })
    : undefined
  return {
    Node: {
      dir: dirs.Node,
      bin: bin => path.join(dirs.Node, `${bin}.ts`),
    },
    Bundle: {
      dir: dirs.Bundle,
      bin: bin => path.join(dirs.Bundle, `${bin}.js`),
      prepare: () => bundle({ outdir: dirs.Bundle, bins }),
      cleanup: createCleanup(dirs.Bundle),
    },
    Compile: {
      dir: dirs.Compile,
      bin: bin =>
        path.join(dirs.Compile, bin) + (windows ? '.exe' : ''),
      prepare: () =>
        compile({ outdir: dirs.Compile, bins, quiet: true }),
      cleanup: createCleanup(dirs.Compile),
    },
  } as const
}

export const Variants: Partial<
  Record<Variant, Pick<VariantOptions, 'env'>>
> = {
  Node: {
    env: {
      NODE_OPTIONS:
        '--no-warnings --enable-source-maps --experimental-strip-types',
    },
  },
  Bundle: {
    env: {
      NODE_OPTIONS: '--no-warnings --enable-source-maps',
    },
  },
}

export const createVariants = ({
  artifacts,
  node = 'node',
}: {
  artifacts: Record<ArtifactKey, Artifact>
  node?: string
  deno?: string
}): Record<Variant, VariantWithArtifact> =>
  ({
    Node: {
      artifact: artifacts.Node,
      args: bin => [node, artifacts.Node.bin(bin)],
      ...Variants.Node,
    },
    Bundle: {
      artifact: artifacts.Bundle,
      args: bin => [node, artifacts.Bundle.bin(bin)],
      ...Variants.Bundle,
    },
    Compile: {
      artifact: artifacts.Compile,
      args: bin => [artifacts.Compile.bin(bin)],
      PATH: artifacts.Compile.dir,
      ...Variants.Compile,
    },
  }) as const
