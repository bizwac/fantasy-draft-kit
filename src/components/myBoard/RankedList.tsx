import { useRef, useState } from "react";

// Pointer-events-based drag reorder — not HTML5 drag-and-drop, which
// doesn't fire from touch on iPad Safari at all. Unifies mouse + touch
// via the Pointer Events API instead. Re-measures row positions from
// live refs on every move (fine at "curated cheat sheet" scale; this
// isn't meant to hold the full 4000+ player pool).
export default function RankedList<T>({
  items,
  getId,
  renderItem,
  onReorder
}: {
  items: T[];
  getId: (item: T) => string;
  renderItem: (item: T, index: number, dragHandleProps: React.HTMLAttributes<HTMLButtonElement>) => React.ReactNode;
  onReorder: (orderedIds: string[]) => void;
}) {
  const [order, setOrder] = useState<string[]>(() => items.map(getId));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const dragStartY = useRef(0);
  const liveOrder = useRef<string[]>(order);

  // Keep displayed order in sync with upstream data (e.g. a note saved
  // elsewhere) without fighting an in-progress drag.
  const currentIds = items.map(getId);
  if (!draggingId && (order.length !== currentIds.length || order.some((id, i) => id !== currentIds[i]))) {
    setOrder(currentIds);
    liveOrder.current = currentIds;
  }

  const itemsById = new Map(items.map((item) => [getId(item), item]));

  function handlePointerDown(id: string, e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingId(id);
    dragStartY.current = e.clientY;
    liveOrder.current = order;
    setDragOffsetY(0);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!draggingId) return;
    setDragOffsetY(e.clientY - dragStartY.current);

    const others = liveOrder.current.filter((id) => id !== draggingId);
    let targetIndex = others.length;
    for (let i = 0; i < others.length; i++) {
      const el = rowRefs.current.get(others[i]);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if (e.clientY < midpoint) {
        targetIndex = i;
        break;
      }
    }
    const next = [...others.slice(0, targetIndex), draggingId, ...others.slice(targetIndex)];
    if (next.some((id, i) => id !== liveOrder.current[i])) {
      liveOrder.current = next;
      setOrder(next);
    }
  }

  function handlePointerUp() {
    if (!draggingId) return;
    setDraggingId(null);
    setDragOffsetY(0);
    onReorder(liveOrder.current);
  }

  return (
    <div className="flex flex-col gap-2">
      {order.map((id, index) => {
        const item = itemsById.get(id);
        if (!item) return null;
        const isDragging = id === draggingId;
        return (
          <div
            key={id}
            ref={(el) => {
              if (el) rowRefs.current.set(id, el);
              else rowRefs.current.delete(id);
            }}
            style={
              isDragging
                ? { transform: `translateY(${dragOffsetY}px)`, position: "relative", zIndex: 10, opacity: 0.95 }
                : undefined
            }
          >
            {renderItem(item, index + 1, {
              onPointerDown: (e) => handlePointerDown(id, e),
              onPointerMove: handlePointerMove,
              onPointerUp: handlePointerUp,
              onPointerCancel: handlePointerUp
            })}
          </div>
        );
      })}
    </div>
  );
}
