/** Ask the browser not to evict IndexedDB under storage pressure. */
export async function requestPersistentStorage() {
  const storage = globalThis.navigator?.storage;
  if (!storage?.persist) return false;
  try {
    if (await storage.persisted?.()) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}
