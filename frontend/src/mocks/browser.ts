import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

/** Browser-side MSW worker (backend not yet online). */
export const worker = setupWorker(...handlers);
