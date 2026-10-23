import { useEffect, useMemo, type DependencyList } from "react";

/**
 * Baut eine GPU-Ressource (Geometrie, Textur …) und gibt sie frei, sobald sie ersetzt wird oder die
 * Komponente verschwindet. Gebaut wird wie bei `useMemo` nur, wenn sich `deps` ändern.
 */
export function useDisposable<T extends { dispose: () => void } | null>(
  factory: () => T,
  deps: DependencyList,
): T {
  // Die Abhängigkeiten gibt die aufrufende Stelle vor.
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  const resource = useMemo(factory, deps);
  useEffect(() => () => resource?.dispose(), [resource]);
  return resource;
}
