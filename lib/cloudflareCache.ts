// VPS stub: there is no Cloudflare edge cache in front of this app's
// dynamic routes (nginx serves uploads statically; pages render live).
// Kept so content-edit routes compile unchanged — purge is a no-op.
export async function purgeCloudflareCache(_urls: string[]): Promise<boolean> {
  return true;
}

// Same story: used to purge + re-render after content edits. Pages render
// live here, so there is nothing to warm.
export async function purgeAndWarm(_urls: string[]): Promise<boolean> {
  return true;
}
