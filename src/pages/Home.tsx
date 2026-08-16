import { useLiveQuery } from "dexie-react-hooks";
import type { MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db } from "@/lib/db";
import { createDraft, deleteDraft, duplicateDraft } from "@/lib/draftRepo";
import { rosterSlotCount } from "@/lib/draftMath";
import type { Draft } from "@/lib/types";
import Badge from "@/components/player/Badge";
import PageHeader from "@/components/shared/PageHeader";

export default function Home() {
  const navigate = useNavigate();
  const drafts = useLiveQuery(() => db.drafts.orderBy("createdAt").reverse().toArray(), []);

  async function handleCreate() {
    const draft = await createDraft("New Draft");
    navigate(`/draft/${draft.id}/setup`);
  }

  async function handleCreateMock() {
    const draft = await createDraft("Mock Draft", undefined, true);
    navigate(`/draft/${draft.id}/setup`);
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <PageHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-display">Drafts</h1>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={handleCreateMock}>
              New Mock Draft
            </button>
            <button type="button" className="btn-primary" onClick={handleCreate}>
              New Draft
            </button>
          </div>
        </div>
      </PageHeader>

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

  async function handleDuplicate(e: MouseEvent) {
    e.preventDefault();
    await duplicateDraft(draft.id);
  }

  async function handleDelete(e: MouseEvent) {
    e.preventDefault();
    if (confirm(`Delete "${draft.name}"? This can't be undone.`)) {
      await deleteDraft(draft.id);
    }
  }

  const to =
    draft.status === "setup"
      ? `/draft/${draft.id}/setup`
      : draft.status === "complete"
        ? `/draft/${draft.id}/results`
        : `/draft/${draft.id}/board`;

  return (
    <li>
      <Link to={to} className="card flex items-center justify-between p-4 hover:border-accent transition-colors">
        <div className="flex flex-col gap-1">
          <span className="font-display font-semibold flex items-center gap-2">
            {draft.name}
            {draft.isMock && <Badge tone="info">Mock</Badge>}
          </span>
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
