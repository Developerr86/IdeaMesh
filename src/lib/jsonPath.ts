// Lightweight JSON-path helpers for our refinement flow.
//
// Path syntax supported: dotted keys + bracketed numeric indices.
//   "prosCons.cons[0]"          -> ["prosCons", "cons", 0]
//   "blueprint.buildPhases[2].tasks[1]"
//
// We deliberately do NOT support quoted keys, wildcards, or filter expressions —
// the schema is fixed and known at compile time.

export type PathSegment = string | number

export function parsePath(path: string): PathSegment[] {
  const segments: PathSegment[] = []
  // Split on "." then expand any "key[idx]" tokens into ["key", idx].
  for (const token of path.split('.')) {
    if (!token) continue
    const re = /([^\[\]]+)|\[(\d+)\]/g
    let m: RegExpExecArray | null
    while ((m = re.exec(token)) !== null) {
      if (m[1] !== undefined) segments.push(m[1])
      else if (m[2] !== undefined) segments.push(Number(m[2]))
    }
  }
  return segments
}

export function getAtPath(root: unknown, path: string): unknown {
  let cur: unknown = root
  for (const seg of parsePath(path)) {
    if (cur == null) return undefined
    if (typeof seg === 'number') {
      if (!Array.isArray(cur)) return undefined
      cur = cur[seg]
    } else {
      if (typeof cur !== 'object') return undefined
      cur = (cur as Record<string, unknown>)[seg]
    }
  }
  return cur
}

// Returns a shallow-cloned root with the value at `path` replaced.
// Each level along the path is cloned (objects -> object spread, arrays -> slice),
// so React sees new references for changed branches while sharing unchanged ones.
export function setAtPath<T>(root: T, path: string, value: unknown): T {
  const segments = parsePath(path)
  if (segments.length === 0) return value as T

  function walk(node: unknown, idx: number): unknown {
    const seg = segments[idx]
    const isLast = idx === segments.length - 1

    if (typeof seg === 'number') {
      const arr = Array.isArray(node) ? node.slice() : []
      arr[seg] = isLast ? value : walk(arr[seg], idx + 1)
      return arr
    }
    const obj = node && typeof node === 'object' ? { ...(node as Record<string, unknown>) } : {}
    obj[seg] = isLast ? value : walk(obj[seg], idx + 1)
    return obj
  }

  return walk(root, 0) as T
}
