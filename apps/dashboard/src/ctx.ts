import { createContext, useContext } from "react";
import type { ActionBody, Persona, Store } from "./lib";

export type Ctx = {
  store: Store;
  persona: Persona;
  interactive: boolean;
  busy: boolean;
  run: (label: string, body: ActionBody) => Promise<boolean>;
};
export const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => useContext(AppCtx)!;
