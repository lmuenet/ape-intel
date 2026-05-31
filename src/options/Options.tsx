import { useEffect, useState } from "preact/hooks";
import { browserStorageKvStore, type KvStore } from "../lib/kv-store";
import { DEFAULT_EXPORT_PROMPT } from "../lib/briefing";
import { LOG_LEVEL_KEY, resolveLevel, type LogLevel, type LogEntry } from "../lib/logger";
import { KeySection } from "./KeySection";
import { PromptSection } from "./PromptSection";
import { LogsSection } from "./LogsSection";
import "./options.css";

export type Send = <T>(message: unknown) => Promise<T>;

const defaultSend: Send = async (message) => (await browser.runtime.sendMessage(message)) as never;
const defaultStore = (): KvStore => browserStorageKvStore(browser.storage.local);

const FINNHUB_KEY = "finnhub:apiKey";
const PROMPT_KEY = "export:prompt";

type Loadable = LogEntry[] | null | undefined;

export interface OptionsProps {
  send?: Send;
  store?: KvStore;
}

export function Options({ send = defaultSend, store = defaultStore() }: OptionsProps) {
  const [finnhubKey, setFinnhubKey] = useState("");
  const [prompt, setPrompt] = useState(DEFAULT_EXPORT_PROMPT);
  const [promptCustom, setPromptCustom] = useState(false);
  const [level, setLevel] = useState<LogLevel>(resolveLevel(undefined, import.meta.env.DEV));
  const [logs, setLogs] = useState<Loadable>(undefined);

  function loadLogs(): void {
    setLogs(undefined);
    send<LogEntry[]>({ type: "log:read" }).then(setLogs, () => setLogs(null));
  }

  useEffect(() => {
    store.get<string>(FINNHUB_KEY).then((k) => setFinnhubKey(k ?? ""));
    store.get<string>(PROMPT_KEY).then((p) => {
      if (p !== undefined) {
        setPrompt(p);
        setPromptCustom(true);
      }
    });
    store.get<LogLevel>(LOG_LEVEL_KEY).then((l) => setLevel(resolveLevel(l, import.meta.env.DEV)));
    loadLogs();
  }, [store, send]);

  function onSaveKey(key: string): void { setFinnhubKey(key); void store.set(FINNHUB_KEY, key); }
  function onDeleteKey(): void { setFinnhubKey(""); void store.remove(FINNHUB_KEY); }
  function onSavePrompt(text: string): void {
    // A blank prompt would silently break exports; treat saving empty as a reset.
    if (text.trim().length === 0) { onResetPrompt(); return; }
    setPrompt(text); setPromptCustom(true); void store.set(PROMPT_KEY, text);
  }
  function onResetPrompt(): void { setPrompt(DEFAULT_EXPORT_PROMPT); setPromptCustom(false); void store.remove(PROMPT_KEY); }
  function onLevelChange(l: LogLevel): void { setLevel(l); void store.set(LOG_LEVEL_KEY, l); }
  function onClearLogs(): void { send({ type: "log:clear" }).then(loadLogs, loadLogs); }

  return (
    <div class="ape-options">
      <header class="ape-options__brand">Ape Intel — Settings</header>
      <KeySection value={finnhubKey} onSave={onSaveKey} onDelete={onDeleteKey} />
      <PromptSection value={prompt} isCustom={promptCustom} onSave={onSavePrompt} onReset={onResetPrompt} />
      <LogsSection level={level} onLevelChange={onLevelChange} entries={logs} onRefresh={loadLogs} onClear={onClearLogs} />
    </div>
  );
}
