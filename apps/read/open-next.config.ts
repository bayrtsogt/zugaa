import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every page is rendered per request (user-specific lock state), so no
// incremental cache is configured. See DECISIONS.md.
export default defineCloudflareConfig({});
