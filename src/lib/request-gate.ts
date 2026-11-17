/**
 * Eşzamansız isteklerde "yalnızca son isteğin sonucu geçerli" kuralı.
 * `begin()` yeni bir sürüm verir; eski sürümler `isLatest` ile elenir.
 */
export function createRequestGate() {
  let version = 0;
  return {
    begin: () => ++version,
    isLatest: (token: number) => token === version,
  };
}
