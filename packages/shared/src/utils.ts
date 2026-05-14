export function ok<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function err<E = Error>(error: E): { ok: false; error: E } {
  return { ok: false, error };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
