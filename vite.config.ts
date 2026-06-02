import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

import { helpdeskTicketApiPlugin } from "./server/helpdeskVitePlugin";

export default defineConfig({
  plugins: [vue(), helpdeskTicketApiPlugin()],
});
