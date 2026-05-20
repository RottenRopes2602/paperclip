import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const PLUGIN_ID = "mangoclaw666.paperclip-plugin-catalog";
const PLUGIN_VERSION = "0.1.0";

const SLOT_AGENT_ROLES = "catalog-agent-roles";
const SLOT_SIDEBAR_AGENT_ROLES = "catalog-agent-roles-sidebar";

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Catalog",
  description:
    "Read-only reference catalogs for PaperClip's available options. Today: Agent Roles (12 roles). Future: Issue Statuses, Agent Icons, Adapter Types. Browse-only.",
  author: "mangoclaw666",
  categories: ["ui"],
  capabilities: ["ui.page.register", "ui.sidebar.register"],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  ui: {
    slots: [
      {
        type: "page",
        id: SLOT_AGENT_ROLES,
        displayName: "Agent Roles",
        exportName: "AgentRolesPage",
        routePath: "catalog-agent-roles",
        order: 10,
      },
      {
        type: "sidebar",
        id: SLOT_SIDEBAR_AGENT_ROLES,
        displayName: "Agent Roles",
        exportName: "AgentRolesSidebarLink",
        order: 200,
      },
    ],
  },
};

export default manifest;
