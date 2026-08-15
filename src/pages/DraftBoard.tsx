import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "@/lib/db";
import type { Draft } from "@/lib/types";

export default function DraftBoard() {
  const { id } = useParams<{ id: string }>();
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    if (!id) return;
    db.drafts.get(id).then((d) => setDraft(d ?? null));
  }, [id]);

  if (!draft) return <p className="text-text-secondary">Loading…</p>;

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-display">{draft.name}</h1>
      <div className="card p-6 text-text-secondary">
        The live draft board — player list, mark-drafted, undo, draft log, turn tracker — lands in M3.
        Settings are saved: {draft.settings.teams} teams, slot {draft.settings.myDraftSlot}, {draft.settings.scoring}.
      </div>
    </div>
  );
}
