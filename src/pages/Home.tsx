import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate } from "react-router-dom";
import { db } from "@/lib/db";
import { createDraft, deleteDraft, duplicateDraft } from "@/lib/draftRepo";
import { rosterSlotCount } from "@/lib/draftMath";
import type { Draft } from "@/lib/types";

export default function Home() {
  const navigate = useNavigate();
  const drafts = useLiveQuery(() => db.drafts.orderBy("createdAt").reverse().toArray(), []);

  async function handleCreate() {
    const draft = await createDraft("New Draft");
    navigate(`/draft/${draft.id}/setup`);
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display">Drafts</h1>
        <button type="button" className="btn-primary" onClick={handleCreate}>
          New Draft
        </button>
      </div>

      {drafts === undefined && <p className="text-text-secondary">Loading…</p>}

      {drafts?.length === 0 && (
        <div className="card p-8 text-center text-text-secondary">
          No drafts yet — tap <span className="font-medium text-text-primary">New Draft</span> to set one up.
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {drafts?.map((draft) => (
          <DraftCard key={draft.id} draft={draft} />
        ))}
      </ul>
    </div>
  );
}

function DraftCard({ draft }: { draft: Draft }) {
  const total = draft.settings.teams * rosterSlotCount(draft.settings.rosterSlots);
  const picked = draft.picks.length;

  async function handleDuplicate(e: React.MouseEvent) {
    e.preventDefault();
    await duplicateDraft(draft.id);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    if (confirm(`Delete "${draft.name}"? This can't be undone.`)) {
      await deleteDraft(draft.id);
    }
  }

  const to = draft.status === "setup" ? `/draft/${draft.id}/setup` : `/draft/${draft.id}/board`;

  return (
    <li>
      <Link to={to} className="card flex items-center justify-between p-4 hover:border-accent transition-colors">
        <div className="flex flex-col gap-1">
          <span className="font-display font-semibold">{draft.name}</span>
          <span className="text-sm text-text-secondary">
            {draft.settings.teams} teams · {draft.settings.scoring.toUpperCase()} ·{" "}
            {statusLabel(draft.status)}
            {draft.status !== "setup" && ` · ${picked}/${total} picked`}
          </span>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary text-sm" onClick={handleDuplicate}>
            Duplicate
          </button>
          <button type="button" className="btn-secondary text-sm" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </Link>
    </li>
  );
}

function statusLabel(status: Draft["status"]) {
  if (status === "setup") return "Not started";
  if (status === "live") return "Live";
  return "Complete";
}
