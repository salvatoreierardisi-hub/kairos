export type TaskStatus = "open" | "inProgress" | "done" | "cancelled";
export type Priority = "highest" | "high" | "medium" | "low" | "lowest";
export type PanelView = "inbox" | "today" | "upcoming" | "all";

export interface Task {
  text: string;
  status: TaskStatus;
  due: string | null; // "YYYY-MM-DD" o null
  scheduled: string | null; // data pianificata `⏳`, usata se `due` manca
  completed: string | null; // "YYYY-MM-DD" o null, data del marcatore ✅
  cancelled: string | null; // data del marcatore ❌, se presente
  priority: Priority | null;
  tags: string[];     // es. ["progetto/casa"]
  file: string;       // path relativo al vault
  line: number;       // riga 0-based
  /** Riga Markdown esatta letta dall'indice; usata per validare le scritture. */
  source: string;
  /** Nota di approfondimento collegata con alias `Dettagli`, se presente. */
  detailPath?: string;
  /** Identificatore Obsidian stabile del blocco task (`^kairos-...`). */
  blockId?: string;
}

export type DailyConfigMode = "obsidian" | "custom";

export interface Settings {
  inboxPath: string;      // es. "_inbox/Inbox.md"
  dailyFolder: string;    // es. "02 Daily"
  dailyFormat: string;    // es. "YYYY-MM-DD"
  dailyTemplate: string;  // path opzionale al template
  dailyConfigMode: DailyConfigMode;
  projectPrefix: string;  // es. "progetto/"
  areaPrefix: string;     // es. "area/"
  agendaHorizonDays: number;
  excludeFolders: string[];
  savedViews: SavedView[];
  /** Stato del pannello (filtro/ordina/raggruppa/collassati), persistito tra le sessioni. */
  panelState?: TaskPanelState;
}

export const DEFAULT_SETTINGS: Settings = {
  inboxPath: "_inbox/Inbox.md",
  dailyFolder: "02 Daily",
  dailyFormat: "YYYY-MM-DD",
  dailyTemplate: "",
  dailyConfigMode: "obsidian",
  projectPrefix: "progetto/",
  areaPrefix: "area/",
  agendaHorizonDays: 14,
  excludeFolders: [],
  savedViews: [],
};

export interface NewTaskInput {
  text: string;
  due: string | null;
  scheduled?: string | null;
  /** Priorità esplicita della QuickAdd evoluta. Se assente, `important` scrive `high`. */
  priority?: Priority | null;
  important: boolean;
  /** Se impostato, il task viene scritto in questa nota (override della risoluzione da settings). */
  targetPath?: string;
  detailPath?: string;
  blockId?: string;
}

import type { TaskFilter, GroupKey } from "./core/query";
import type { SortKey } from "./core/sorting";

export interface SavedView {
  name: string;
  filter: TaskFilter;
  sort: SortKey;
  group: GroupKey;
}

/** Stato pilotante del TaskPanel. Tipi puri (no `obsidian`) così vive nei Settings. */
export interface TaskPanelState {
  view: PanelView;
  filter: TaskFilter;
  sort: SortKey;
  group: GroupKey;
  collapsed: string[];
}
