import { useEffect, useRef, useState } from "react";
import { getStorageEstimate } from "@/lib/persistence";
import { refreshPlayerData, type RefreshResult } from "@/lib/dataSources/refresh";
import { applyProjectionImport } from "@/lib/dataSources/projectionsImport";
import { parseCsvFile, applyColumnMapping, type ProjectionColumnMapping } from "@/lib/dataSources/csvImport";
import { loadRefreshStatus, saveRefreshStatus, isStale, type RefreshStatus } from "@/lib/refreshStatus";
import type { ScoringFormat } from "@/lib/types";
import { db } from "@/lib/db";

const TEAM_OPTIONS = [8, 10, 12, 14];
const SCORING_OPTIONS: Array<{ value: ScoringFormat; label: string }> = [
  { value: "ppr", label: "Full PPR" },
  { value: "half", label: "Half PPR" },
  { value: "std", label: "Standard" },
  { value: "superflex-ppr", label: "Superflex" }
];

export default function DataRefresh() {
  const [storage, setStorage] = useState<Awaited<ReturnType<typeof getStorageEstimate>> | null>(null);
  const [status, setStatus] = useState<RefreshStatus>(() => loadRefreshStatus());
  const [teams, setTeams] = useState(12);
  const [scoring, setScoring] = useState<ScoringFormat>("ppr");
  const [year, setYear] = useState(new Date().getFullYear());
  const [refreshing, setRefreshing] = useState(false);
  const [lastResult, setLastResult] = useState<RefreshResult | null>(null);
  const [playerCount, setPlayerCount] = useState<number | null>(null);

  useEffect(() => {
    getStorageEstimate().then(setStorage);
    db.players.count().then(setPlayerCount);
  }, [lastResult]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const result = await refreshPlayerData({ teams, scoring, year });
      setLastResult(result);
      const next: RefreshStatus = {
        ...status,
        sleeper: result.sleeper,
        adp: result.adp
      };
      setStatus(next);
      saveRefreshStatus(next);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6 pb-24">
      <h1 className="text-2xl font-display">Data Refresh</h1>

      <section className="card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-secondary">Teams</span>
            <select
              className="rounded-md bg-surface-sunken px-3 py-2 min-h-touch"
              value={teams}
              onChange={(e) => setTeams(Number(e.target.value))}
            >
              {TEAM_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-secondary">Scoring</span>
            <select
              className="rounded-md bg-surface-sunken px-3 py-2 min-h-touch"
              value={scoring}
              onChange={(e) => setScoring(e.target.value as ScoringFormat)}
            >
              {SCORING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-secondary">Season</span>
            <input
              type="number"
              className="rounded-md bg-surface-sunken px-3 py-2 min-h-touch w-24"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
          <button type="button" className="btn-primary" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh Player Data"}
          </button>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <SourceRow label="Sleeper (players, injuries, depth)" outcome={status.sleeper} />
          <SourceRow label="Fantasy Football Calculator (ADP)" outcome={status.adp} />
        </div>

        {playerCount !== null && (
          <p className="text-sm text-text-secondary">{playerCount} players in the local dataset.</p>
        )}

        {storage && (
          <p className="text-xs text-text-secondary">
            Storage: {storage.usageMB?.toFixed(1) ?? "—"} MB used
            {storage.quotaMB ? ` of ${storage.quotaMB.toFixed(0)} MB` : ""} ·{" "}
            {storage.persisted ? "persisted (protected from eviction)" : "not yet persisted"}
          </p>
        )}
      </section>

      <ProjectionsImportCard
        onImported={(at) => {
          const next = { ...status, lastProjectionsImportAt: at };
          setStatus(next);
          saveRefreshStatus(next);
        }}
        lastImportAt={status.lastProjectionsImportAt}
      />
    </div>
  );
}

function SourceRow({ label, outcome }: { label: string; outcome: RefreshStatus["sleeper"] }) {
  if (!outcome) {
    return (
      <div className="flex items-center justify-between text-text-secondary">
        <span>{label}</span>
        <span>Never refreshed</span>
      </div>
    );
  }
  const stale = isStale(outcome.at);
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        {outcome.ok ? (
          <>
            <StatusDot color="var(--success)" />
            <span>
              {outcome.count} loaded · as of {new Date(outcome.at).toLocaleString()}
              {stale && <span className="text-warning"> (stale)</span>}
            </span>
          </>
        ) : (
          <>
            <StatusDot color="var(--danger)" />
            <span className="text-danger">{outcome.error ?? "Failed"}</span>
          </>
        )}
      </span>
    </div>
  );
}

function StatusDot({ color }: { color: string }) {
  return <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />;
}

function ProjectionsImportCard({
  onImported,
  lastImportAt
}: {
  onImported: (at: string) => void;
  lastImportAt: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ProjectionColumnMapping>({ name: "" });
  const [summary, setSummary] = useState<{ matched: number; unmatched: string[] } | null>(null);
  const [importing, setImporting] = useState(false);

  async function handleFile(file: File) {
    setSummary(null);
    const result = await parseCsvFile(file);
    setHeaders(result.headers);
    setRows(result.rows);
    setParseErrors(result.errors);
    const find = (re: RegExp) => result.headers.find((h) => re.test(h));
    setMapping({
      name: find(/name/i) ?? result.headers[0] ?? "",
      projPoints: find(/(proj|pts|points|fpts)/i),
      team: find(/^team$|^tm$/i),
      position: find(/^pos(ition)?$/i),
      contractYear: find(/contract/i),
      teamWinningRecordLastYear: find(/last.?year.?win|2025.?record|prior.?record/i),
      teamProjectedWinning: find(/proj.*win|win.?total|vegas/i),
      sosSeason: find(/sos.?season|strength.?of.?schedule$/i),
      sosPlayoffs: find(/sos.?playoff|playoff.?sos/i),
      snapPct: find(/snap/i),
      targetShare: find(/target.?share/i),
      rzTouches: find(/rz|red.?zone/i)
    });
  }

  async function handleApply() {
    if (!mapping.name) return;
    setImporting(true);
    try {
      const mapped = applyColumnMapping(rows, mapping);
      const result = await applyProjectionImport(mapped);
      setSummary(result);
      onImported(new Date().toISOString());
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="card p-5 flex flex-col gap-4">
      <div>
        <h2 className="font-display font-semibold">Player data import</h2>
        <p className="text-sm text-text-secondary">
          Projections, contract year, winning-team signals, strength of schedule, and usage stats have no free API —
          export a CSV (e.g. from FantasyPros or nflverse) and import it here. Only touches the columns you map;
          everything else stays as Sleeper/ADP loaded it.
        </p>
        {lastImportAt && (
          <p className="text-xs text-text-secondary mt-1">Last imported {new Date(lastImportAt).toLocaleString()}</p>
        )}
      </div>

      <div
        className="rounded-md border-2 border-dashed border-border p-6 text-center text-text-secondary cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        Drop a CSV here, or tap to choose a file
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {parseErrors.length > 0 && (
        <ul className="text-sm text-danger list-disc pl-5">
          {parseErrors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      {headers.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-secondary">{rows.length} rows detected. Map the columns:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <ColumnSelect label="Player name (required)" headers={headers} value={mapping.name} onChange={(v) => setMapping((m) => ({ ...m, name: v }))} />
            <ColumnSelect label="Projected points" headers={headers} value={mapping.projPoints} onChange={(v) => setMapping((m) => ({ ...m, projPoints: v }))} allowNone />
            <ColumnSelect label="Team" headers={headers} value={mapping.team} onChange={(v) => setMapping((m) => ({ ...m, team: v }))} allowNone />
            <ColumnSelect label="Position" headers={headers} value={mapping.position} onChange={(v) => setMapping((m) => ({ ...m, position: v }))} allowNone />
            <ColumnSelect label="Contract year" headers={headers} value={mapping.contractYear} onChange={(v) => setMapping((m) => ({ ...m, contractYear: v }))} allowNone />
            <ColumnSelect
              label="Team won last year (2025)"
              headers={headers}
              value={mapping.teamWinningRecordLastYear}
              onChange={(v) => setMapping((m) => ({ ...m, teamWinningRecordLastYear: v }))}
              allowNone
            />
            <ColumnSelect
              label="Team projected winning (2026)"
              headers={headers}
              value={mapping.teamProjectedWinning}
              onChange={(v) => setMapping((m) => ({ ...m, teamProjectedWinning: v }))}
              allowNone
            />
            <ColumnSelect label="SoS (season)" headers={headers} value={mapping.sosSeason} onChange={(v) => setMapping((m) => ({ ...m, sosSeason: v }))} allowNone />
            <ColumnSelect label="SoS (playoff weeks)" headers={headers} value={mapping.sosPlayoffs} onChange={(v) => setMapping((m) => ({ ...m, sosPlayoffs: v }))} allowNone />
            <ColumnSelect label="Snap %" headers={headers} value={mapping.snapPct} onChange={(v) => setMapping((m) => ({ ...m, snapPct: v }))} allowNone />
            <ColumnSelect label="Target share" headers={headers} value={mapping.targetShare} onChange={(v) => setMapping((m) => ({ ...m, targetShare: v }))} allowNone />
            <ColumnSelect label="Red-zone touches" headers={headers} value={mapping.rzTouches} onChange={(v) => setMapping((m) => ({ ...m, rzTouches: v }))} allowNone />
          </div>
          <button type="button" className="btn-primary self-start" onClick={handleApply} disabled={!mapping.name || importing}>
            {importing ? "Importing…" : "Apply Import"}
          </button>
        </div>
      )}

      {summary && (
        <div className="text-sm">
          <p>
            Matched {summary.matched} player{summary.matched === 1 ? "" : "s"}.
          </p>
          {summary.unmatched.length > 0 && (
            <p className="text-warning">
              Could not match {summary.unmatched.length}: {summary.unmatched.slice(0, 8).join(", ")}
              {summary.unmatched.length > 8 ? "…" : ""}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function ColumnSelect({
  label,
  headers,
  value,
  onChange,
  allowNone
}: {
  label: string;
  headers: string[];
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  allowNone?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      <select
        className="rounded-md bg-surface-sunken px-2 py-2 min-h-touch"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        {allowNone && <option value="">—</option>}
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </label>
  );
}
