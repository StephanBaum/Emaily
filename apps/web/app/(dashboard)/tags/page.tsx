"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSWRConfig } from "swr";
import {
  useGroupOrder,
  useCollapsedGroups,
  useTagOrder,
} from "@/hooks/use-tag-groups";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Pencil,
  Trash2,
  Tag,
  FolderPlus,
  GripVertical,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";

const AI_ACTIONS = [
  { value: "none", label: "None" },
  { value: "draft", label: "Draft reply" },
  { value: "research_draft", label: "Research + Draft" },
  { value: "auto_reply", label: "Auto-reply" },
  { value: "archive", label: "Auto-archive" },
  { value: "notify", label: "Notify team" },
];

const PRESET_COLORS = [
  "#ef4444", "#f59e0b", "#22c55e", "#06b6d4",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7",
  "#ec4899", "#f472b6", "#94a3b8", "#78716c",
];

interface TagData {
  id: string;
  name: string;
  color: string;
  aiAction: string;
  tagGroup: string | null;
  active: boolean;
  _count: { threads: number };
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return { error: `Server error (${res.status})` };
  }
}

// Prefix to distinguish group drag IDs from tag IDs
const GROUP_PREFIX = "group::";

export default function TagsPage() {
  const { mutate: globalMutate } = useSWRConfig();
  const [tags, setTags] = useState<TagData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagData | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Group creation
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [emptyGroups, setEmptyGroups] = useState<string[]>([]);
  const { isCollapsed, toggleGroup } = useCollapsedGroups();
  const { sortGroups, setOrder: setGroupOrder } = useGroupOrder();
  const { sortTags, setTagOrder } = useTagOrder();
  const newGroupInputRef = useRef<HTMLInputElement>(null);

  // Rename group
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null!);

  // Tag form state
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [aiAction, setAiAction] = useState("none");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createInGroup, setCreateInGroup] = useState<string | null>(null);

  // DnD state
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch("/api/tags");
      if (res.ok) {
        const data = await res.json();
        setTags(data);
        globalMutate("/api/tags", data, false);
      }
    } finally {
      setLoading(false);
    }
  }, [globalMutate]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  useEffect(() => {
    if (creatingGroup && newGroupInputRef.current) {
      newGroupInputRef.current.focus();
    }
  }, [creatingGroup]);

  useEffect(() => {
    if (renamingGroup && renameInputRef.current) {
      renameInputRef.current.focus();
    }
  }, [renamingGroup]);

  // Derive groups from tags + empty groups
  const tagGroups = useMemo(() => {
    const groups = new Map<string, TagData[]>();
    for (const tag of tags) {
      const group = tag.tagGroup || "";
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(tag);
    }
    for (const g of emptyGroups) {
      if (!groups.has(g)) groups.set(g, []);
    }
    return groups;
  }, [tags, emptyGroups]);

  const groupNames = useMemo(
    () => sortGroups(Array.from(tagGroups.keys()).filter((k) => k !== "")),
    [tagGroups, sortGroups]
  );
  const ungroupedTags = useMemo(
    () => sortTags("", tagGroups.get("") || []),
    [tagGroups, sortTags]
  );

  // Sortable IDs for dnd-kit
  const groupSortableIds = useMemo(
    () => groupNames.map((g) => `${GROUP_PREFIX}${g}`),
    [groupNames]
  );

  // Helper: find which group a tag belongs to
  function findTagGroup(tagId: string): string {
    const tag = tags.find((t) => t.id === tagId);
    return tag?.tagGroup || "";
  }

  // --- DnD handlers ---
  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    // Only handle tag-over-different-group (cross-container move)
    if (activeIdStr.startsWith(GROUP_PREFIX)) return;

    const activeGroup = findTagGroup(activeIdStr);
    let overGroup: string;

    if (overIdStr.startsWith(GROUP_PREFIX)) {
      // Dragging over a group header => move to that group
      overGroup = overIdStr.slice(GROUP_PREFIX.length);
    } else if (overIdStr.startsWith("container::")) {
      // Dragging over an empty group container
      overGroup = overIdStr.slice("container::".length);
    } else {
      // Dragging over another tag
      overGroup = findTagGroup(overIdStr);
    }

    if (activeGroup !== overGroup) {
      // Move tag to the other group (optimistic)
      setTags((prev) =>
        prev.map((t) =>
          t.id === activeIdStr
            ? { ...t, tagGroup: overGroup || null }
            : t
        )
      );
      // Persist to server
      fetch(`/api/tags/${activeIdStr}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagGroup: overGroup || null }),
      });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    // Group reordering
    if (activeIdStr.startsWith(GROUP_PREFIX) && overIdStr.startsWith(GROUP_PREFIX)) {
      const activeGroup = activeIdStr.slice(GROUP_PREFIX.length);
      const overGroup = overIdStr.slice(GROUP_PREFIX.length);
      const oldIndex = groupNames.indexOf(activeGroup);
      const newIndex = groupNames.indexOf(overGroup);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(groupNames, oldIndex, newIndex);
        setGroupOrder(newOrder);
      }
      return;
    }

    // Tag reordering within the same group
    if (!activeIdStr.startsWith(GROUP_PREFIX) && !overIdStr.startsWith(GROUP_PREFIX) && !overIdStr.startsWith("container::")) {
      const activeGroup = findTagGroup(activeIdStr);
      const overGroup = findTagGroup(overIdStr);
      if (activeGroup === overGroup) {
        const groupKey = activeGroup;
        const groupTags = sortTags(groupKey, tagGroups.get(groupKey) || []);
        const tagIds = groupTags.map((t) => t.id);
        const oldIndex = tagIds.indexOf(activeIdStr);
        const newIndex = tagIds.indexOf(overIdStr);
        if (oldIndex !== -1 && newIndex !== -1) {
          const newTagIds = arrayMove(tagIds, oldIndex, newIndex);
          setTagOrder(groupKey, newTagIds);
        }
      }
    }
  }

  // --- Group actions ---
  function handleCreateGroup() {
    const trimmed = newGroupName.trim();
    if (!trimmed || tagGroups.has(trimmed)) {
      setCreatingGroup(false);
      setNewGroupName("");
      return;
    }
    setEmptyGroups((prev) => [...prev, trimmed]);
    setGroupOrder((prev) => [...prev, trimmed]);
    setCreatingGroup(false);
    setNewGroupName("");
  }

  async function handleRenameGroup(oldName: string) {
    const trimmed = renameValue.trim();
    setRenamingGroup(null);
    if (!trimmed || trimmed === oldName || tagGroups.has(trimmed)) return;

    const groupTags = tagGroups.get(oldName) || [];
    setTags((prev) =>
      prev.map((t) =>
        t.tagGroup === oldName ? { ...t, tagGroup: trimmed } : t
      )
    );
    setEmptyGroups((prev) =>
      prev.map((g) => (g === oldName ? trimmed : g))
    );
    setGroupOrder((prev) =>
      prev.map((g) => (g === oldName ? trimmed : g))
    );

    await Promise.all(
      groupTags.map((tag) =>
        fetch(`/api/tags/${tag.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagGroup: trimmed }),
        })
      )
    );
  }

  function handleDeleteGroup(groupName: string) {
    const groupTags = tagGroups.get(groupName) || [];
    setTags((prev) =>
      prev.map((t) =>
        t.tagGroup === groupName ? { ...t, tagGroup: null } : t
      )
    );
    setEmptyGroups((prev) => prev.filter((g) => g !== groupName));
    setGroupOrder((prev) => prev.filter((g) => g !== groupName));

    groupTags.forEach((tag) =>
      fetch(`/api/tags/${tag.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagGroup: null }),
      })
    );
  }

  // --- Tag CRUD ---
  function openCreate(group?: string) {
    setEditingTag(null);
    setName("");
    setColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
    setAiAction("none");
    setCreateInGroup(group ?? null);
    setError("");
    setDialogOpen(true);
  }

  function openEdit(tag: TagData) {
    setEditingTag(tag);
    setName(tag.name);
    setColor(tag.color);
    setAiAction(tag.aiAction);
    setCreateInGroup(tag.tagGroup);
    setError("");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Tag name is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const url = editingTag ? `/api/tags/${editingTag.id}` : "/api/tags";
      const method = editingTag ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          color,
          aiAction,
          tagGroup: createInGroup || null,
        }),
      });

      if (!res.ok) {
        const data = await safeJson(res);
        setError(data.error || "Failed to save tag");
        return;
      }

      setDialogOpen(false);
      fetchTags();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save tag");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/tags/${id}`, { method: "DELETE" });
    setDeleteConfirm(null);
    fetchTags();
  }

  // Active drag item for overlay
  const activeTag = activeId && !activeId.startsWith(GROUP_PREFIX)
    ? tags.find((t) => t.id === activeId)
    : null;
  const activeGroupName = activeId?.startsWith(GROUP_PREFIX)
    ? activeId.slice(GROUP_PREFIX.length)
    : null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 items-center justify-between border-b px-6">
        <h1 className="text-lg font-semibold">Manage Tags</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCreatingGroup(true);
              setNewGroupName("");
            }}
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            New Group
          </Button>
          <Button size="sm" onClick={() => openCreate()}>
            <Plus className="mr-2 h-4 w-4" />
            New Tag
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg border bg-muted" />
            ))}
          </div>
        ) : tags.length === 0 && emptyGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Tag className="h-12 w-12 text-muted-foreground/40" />
            <h2 className="mt-4 text-lg font-medium">No tags yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create tags to organize your email threads. Group them for the sidebar.
            </p>
            <Button className="mt-4" onClick={() => openCreate()}>
              <Plus className="mr-2 h-4 w-4" />
              Create your first tag
            </Button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="space-y-6">
              {/* New group inline input */}
              {creatingGroup && (
                <div className="flex items-center gap-2">
                  <Input
                    ref={newGroupInputRef}
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Group name..."
                    className="max-w-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateGroup();
                      if (e.key === "Escape") {
                        setCreatingGroup(false);
                        setNewGroupName("");
                      }
                    }}
                  />
                  <Button size="sm" onClick={handleCreateGroup}>
                    Create
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCreatingGroup(false);
                      setNewGroupName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {/* Sortable groups */}
              <SortableContext
                items={groupSortableIds}
                strategy={verticalListSortingStrategy}
              >
                {groupNames.map((group) => {
                  const groupTags = sortTags(group, tagGroups.get(group) || []);
                  const groupCollapsed = isCollapsed(group);

                  return (
                    <SortableGroup
                      key={group}
                      id={`${GROUP_PREFIX}${group}`}
                      group={group}
                      groupTags={groupTags}
                      isCollapsed={groupCollapsed}
                      isRenaming={renamingGroup === group}
                      renameValue={renameValue}
                      renameInputRef={renameInputRef}
                      onToggleCollapse={() => toggleGroup(group)}
                      onRenameStart={() => {
                        setRenamingGroup(group);
                        setRenameValue(group);
                      }}
                      onRenameChange={setRenameValue}
                      onRenameSubmit={() => handleRenameGroup(group)}
                      onRenameCancel={() => setRenamingGroup(null)}
                      onDeleteGroup={() => handleDeleteGroup(group)}
                      onCreateTag={() => openCreate(group)}
                      onEditTag={openEdit}
                      onDeleteTag={handleDelete}
                      deleteConfirm={deleteConfirm}
                      setDeleteConfirm={setDeleteConfirm}
                      sortTags={sortTags}
                    />
                  );
                })}
              </SortableContext>

              {/* Ungrouped */}
              <div className="rounded-lg border border-border">
                <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30 rounded-t-lg">
                  <span className="font-medium text-sm text-muted-foreground">
                    Ungrouped
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Add ungrouped tag"
                    onClick={() => openCreate()}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="p-2 min-h-[48px]">
                  {ungroupedTags.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground italic">
                      No ungrouped tags
                    </p>
                  ) : (
                    <SortableContext
                      items={ungroupedTags.map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-1">
                        {ungroupedTags.map((tag) => (
                          <SortableTagCard
                            key={tag.id}
                            tag={tag}
                            onEdit={openEdit}
                            onDelete={handleDelete}
                            deleteConfirm={deleteConfirm}
                            setDeleteConfirm={setDeleteConfirm}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  )}
                </div>
              </div>
            </div>

            {/* Drag overlay */}
            <DragOverlay>
              {activeTag ? (
                <div className="rounded-md border bg-background px-3 py-2 shadow-lg opacity-90 flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                  <span
                    className="h-3.5 w-3.5 rounded-full"
                    style={{ backgroundColor: activeTag.color }}
                  />
                  <span className="font-medium text-sm">{activeTag.name}</span>
                </div>
              ) : activeGroupName ? (
                <div className="rounded-lg border bg-muted/30 px-4 py-2.5 shadow-lg opacity-90 flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                  <span className="font-medium text-sm">{activeGroupName}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTag ? "Edit Tag" : "Create Tag"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="space-y-2">
              <Label htmlFor="tag-name">Name</Label>
              <Input
                id="tag-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Support, Billing, Newsletter"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: color === c ? "currentColor" : "transparent",
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">Preview:</span>
                <Badge
                  variant="secondary"
                  style={{ backgroundColor: `${color}20`, color }}
                >
                  {name || "Tag name"}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-action">AI Action</Label>
              <select
                id="ai-action"
                value={aiAction}
                onChange={(e) => setAiAction(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {AI_ACTIONS.map((action) => (
                  <option key={action.value} value={action.value}>
                    {action.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Action the AI takes when this tag is applied to a thread.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={saving}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSave();
                }}
              >
                {saving ? "Saving..." : editingTag ? "Save Changes" : "Create Tag"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sortable Group ──────────────────────────────────────────────────────────

function SortableGroup({
  id,
  group,
  groupTags,
  isCollapsed,
  isRenaming,
  renameValue,
  renameInputRef,
  onToggleCollapse,
  onRenameStart,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onDeleteGroup,
  onCreateTag,
  onEditTag,
  onDeleteTag,
  deleteConfirm,
  setDeleteConfirm,
  sortTags,
}: {
  id: string;
  group: string;
  groupTags: TagData[];
  isCollapsed: boolean;
  isRenaming: boolean;
  renameValue: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  onToggleCollapse: () => void;
  onRenameStart: () => void;
  onRenameChange: (value: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onDeleteGroup: () => void;
  onCreateTag: () => void;
  onEditTag: (tag: TagData) => void;
  onDeleteTag: (id: string) => void;
  deleteConfirm: string | null;
  setDeleteConfirm: (id: string | null) => void;
  sortTags: <T extends { id: string; name: string }>(groupKey: string, tags: T[]) => T[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const tagIds = groupTags.map((t) => t.id);

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border border-border">
      {/* Group header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30 rounded-t-lg">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            className="shrink-0 cursor-grab active:cursor-grabbing touch-none"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/40" />
          </button>
          <button onClick={onToggleCollapse} className="shrink-0">
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {isRenaming ? (
            <Input
              ref={renameInputRef as React.RefObject<HTMLInputElement>}
              value={renameValue}
              onChange={(e) => onRenameChange(e.target.value)}
              className="h-7 max-w-[200px] text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") onRenameSubmit();
                if (e.key === "Escape") onRenameCancel();
              }}
              onBlur={onRenameSubmit}
            />
          ) : (
            <span className="font-medium text-sm truncate">
              {group}
            </span>
          )}

          <span className="text-xs text-muted-foreground shrink-0">
            {groupTags.length} {groupTags.length === 1 ? "tag" : "tags"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Add tag to group"
            onClick={onCreateTag}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Rename group"
            onClick={onRenameStart}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            title="Delete group (tags move to ungrouped)"
            onClick={onDeleteGroup}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Group tags */}
      {!isCollapsed && (
        <div className="p-2 min-h-[48px]">
          {groupTags.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground italic">
              Drag tags here
            </p>
          ) : (
            <SortableContext items={tagIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {groupTags.map((tag) => (
                  <SortableTagCard
                    key={tag.id}
                    tag={tag}
                    onEdit={onEditTag}
                    onDelete={onDeleteTag}
                    deleteConfirm={deleteConfirm}
                    setDeleteConfirm={setDeleteConfirm}
                  />
                ))}
              </div>
            </SortableContext>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sortable Tag Card ───────────────────────────────────────────────────────

function SortableTagCard({
  tag,
  onEdit,
  onDelete,
  deleteConfirm,
  setDeleteConfirm,
}: {
  tag: TagData;
  onEdit: (tag: TagData) => void;
  onDelete: (id: string) => void;
  deleteConfirm: string | null;
  setDeleteConfirm: (id: string | null) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tag.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-3 rounded-md border bg-background px-3 py-2 hover:bg-accent/50 transition-colors"
    >
      <button
        className="shrink-0 cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/40" />
      </button>
      <span
        className="h-3.5 w-3.5 rounded-full shrink-0"
        style={{ backgroundColor: tag.color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{tag.name}</span>
          {tag.aiAction !== "none" && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 leading-4">
              AI: {AI_ACTIONS.find((a) => a.value === tag.aiAction)?.label}
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {tag._count.threads} {tag._count.threads === 1 ? "thread" : "threads"}
        </span>
      </div>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onEdit(tag)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        {deleteConfirm === tag.id ? (
          <div className="flex items-center gap-1">
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => onDelete(tag.id)}
            >
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setDeleteConfirm(null)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteConfirm(tag.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
