import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";

const PLUGIN_NAME = "catalog";

/**
 * fork_mangoclaw: read-only catalog plugin. Worker is intentionally minimal —
 * UI pages render static data from packages/shared/src/constants.ts equivalents
 * and make no API mutations. No subscriptions, no jobs.
 */
const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_NAME} worker ready`);
  },
  async onHealth() {
    return { status: "ok", message: "Catalog plugin ready" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
