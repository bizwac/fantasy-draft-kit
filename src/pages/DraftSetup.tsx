import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "@/lib/db";
import { renameDraft, updateDraftSettings } from "@/lib/draftRepo";
import type { Draft, DraftSettings, RosterSlots, ScoringFormat } from "@/lib/types";
import Badge from "@/components/player/Badge";

const TEAM_COUNT_OPTIONS = [8, 10, 12, 14];
const SCORING_PRESETS: Array<{ value: ScoringFormat; label: string }> = [
  { value: "ppr", label: "Full PPR" },
  { value: "half", label: "Half PPR" },
  { value: "std", label: "Standard" },
  { value: "superflex-ppr", label: "Superflex PPR" }
];

export default function DraftSetup() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [name, setName] = useState("");
  const [settings, setSettings] = useState<DraftSettings | null>(null);

  useEffect(() => {
    if (!id) return;
    db.drafts.get(id).then((d) => {
      if (!d) return;
      setDraft(d);
      setName(d.name);
      setSettings(d.settings);
    });
  }, [id]);

  if (!draft || !settings) {
    return <p className="text-text-secondary">Loading…</p>;
  }

  function setTeamCount(teams: number) {
    setSettings((prev) => {
      if (!prev) return prev;
      const names = [...prev.teamNames];
      if (teams > names.length) {
        while (names.length < teams) names.push(`Team ${names.length + 1}`);
      } else {
        names.length = teams;
      }
      return {
        ...prev,
        teams,
        teamNames: names,
        myDraftSlot: Math.min(prev.myDraftSlot, teams)
      };
    });
  }

  function setTeamName(index: number, value: string) {
    setSettings((prev) => {
      if (!prev) return prev;
      const names = [...prev.teamNames];
      names[index] = value;
      return { ...prev, teamNames: names };
    });
  }

  function setRosterSlot(key: keyof RosterSlots, value: number) {
    setSettings((prev) => (prev ? { ...prev, rosterSlots: { ...prev.rosterSlots, [key]: value } } : prev));
  }

  async function handleSave(startLive: boolean) {
    if (!id || !settings) return;
    const cleanedNames = settings.teamNames.map((n, i) => (n.trim() ? n.trim() : `Team ${i + 1}`));
    const cleanedSettings: DraftSettings = { ...settings, teamNames: cleanedNames };
    await renameDraft(id, name);
    await updateDraftSettings(id, cleanedSettings);
    if (startLive) {
      await db.drafts.update(id, { status: "live" });
      navigate(`/draft/${id}/board`);
    } else {
      navigate("/");
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8 pb-24">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-display flex items-center gap-2">
          Draft Setup
          {draft.isMock && <Badge tone="info">Mock</Badge>}
        </h1>
        {draft.isMock && (
          <p className="text-sm text-text-secondary">
            Every other team will auto-pick best-ADP-available the instant it's their turn — you only need to make
            your own picks.
          </p>
        )}
      </div>

      <section className="card p-5 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-secondary">Draft name</span>
          <input
            className="rounded-md bg-surface-sunken px-3 py-2 min-h-touch"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Home League 2026"
          />
        </label>
      </section>

      <section className="card p-5 flex flex-col gap-4">
        <h2 className="font-display font-semibold">Teams</h2>
        <div className="flex gap-2">
          {TEAM_COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setTeamCount(n)}
              className={[
                "min-h-touch min-w-touch rounded-md px-4 font-medium transition-colors",
                settings.teams === n ? "bg-accent text-accent-ink" : "bg-surface-sunken text-text-primary"
              ].join(" ")}
            >
              {n}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-secondary">Your draft slot</span>
          <select
            className="rounded-md bg-surface-sunken pl-3 pr-8 py-2 min-h-touch w-32"
            value={settings.myDraftSlot}
            onChange={(e) => setSettings((prev) => (prev ? { ...prev, myDraftSlot: Number(e.target.value) } : prev))}
          >
            {Array.from({ length: settings.teams }, (_, i) => i + 1).map((slot) => (
              <option key={slot} value={slot}>
                Slot {slot}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {settings.teamNames.map((teamName, i) => (
            <input
              key={i}
              className="rounded-md bg-surface-sunken px-3 py-2 min-h-touch"
              value={teamName}
              onChange={(e) => setTeamName(i, e.target.value)}
              placeholder={`Team ${i + 1}`}
            />
          ))}
        </div>
      </section>

      <section className="card p-5 flex flex-col gap-4">
        <h2 className="font-display font-semibold">Scoring</h2>
        <div className="flex flex-wrap gap-2">
          {SCORING_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setSettings((prev) => (prev ? { ...prev, scoring: preset.value } : prev))}
              className={[
                "min-h-touch rounded-md px-4 font-medium transition-colors",
                settings.scoring === preset.value ? "bg-accent text-accent-ink" : "bg-surface-sunken text-text-primary"
              ].join(" ")}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card p-5 flex flex-col gap-4">
        <h2 className="font-display font-semibold">Roster slots</h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {(["QB", "RB", "WR", "TE", "FLEX", "K", "DST", "BENCH", "IR"] as const).map((key) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-text-secondary">{key}</span>
              <input
                type="number"
                min={0}
                max={10}
                className="rounded-md bg-surface-sunken px-2 py-2 min-h-touch w-full"
                value={settings.rosterSlots[key as keyof RosterSlots] ?? 0}
                onChange={(e) => setRosterSlot(key as keyof RosterSlots, Number(e.target.value))}
              />
            </label>
          ))}
        </div>
      </section>

      <div className="flex gap-3 justify-end">
        <button type="button" className="btn-secondary" onClick={() => handleSave(false)}>
          Save for later
        </button>
        <button type="button" className="btn-primary" onClick={() => handleSave(true)}>
          Start Draft
        </button>
      </div>
    </div>
  );
}
