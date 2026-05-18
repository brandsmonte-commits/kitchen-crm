import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ВАЖНО: замените 'kitchen-crm' на имя вашего GitHub репозитория
export default defineConfig({
  plugins: [react()],
  base: "/kitchen-crm/",
});
