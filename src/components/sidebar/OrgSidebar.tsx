"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronRight, FileText, FolderPlus, MoreHorizontal, Plus, Search, Upload } from "lucide-react";
import { useApp } from "@/context/AppContext";
import type { ClassRecord, FolderRecord, LectureRecord } from "@/lib/types";

export function OrgSidebar() {
  const pathname = usePathname();
  const { data, createClass, createFolder, rename, remove, moveLecture, openLecture, setUploadOpen } = useApp();
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const [creating, setCreating] = useState<"class" | { folder: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [renaming, setRenaming] = useState<{ kind: "class" | "folder" | "lecture"; id: string } | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const activeId = pathname.startsWith("/lecture/") ? pathname.split("/")[2] : null;

  const filteredLectures = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.lectures;
    return data.lectures.filter((l) => l.title.toLowerCase().includes(q));
  }, [data.lectures, query]);

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-line bg-sidebar">
      <div className="px-4 pb-3 pt-5">
        <Link href="/" className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-ink">
          Lumen
        </Link>
        <p className="mt-0.5 text-xs text-muted">Study notebook</p>
      </div>
      <div className="px-3">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-paper px-2.5 py-1.5">
          <Search size={14} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lectures"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted/70"
          />
        </div>
      </div>
      <div className="mt-3 flex gap-1 px-3">
        <button type="button" className="btn-sidebar" onClick={() => setCreating("class")}>
          <Plus size={14} /> Create Class
        </button>
        <button type="button" className="btn-sidebar" onClick={() => setUploadOpen(true)}>
          <Upload size={14} /> Upload Lecture
        </button>
      </div>
      <nav className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-8">
        <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">My Classes</p>
        {creating === "class" ? (
          <form
            className="px-2 py-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) createClass(draft.trim());
              setDraft("");
              setCreating(null);
            }}
          >
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Class name"
              className="w-full rounded-lg border border-line bg-paper px-2 py-1 text-sm"
              onBlur={() => setCreating(null)}
            />
          </form>
        ) : null}
        {data.classes.length === 0 && data.lectures.length === 0 && creating !== "class" ? (
          <p className="px-2 py-3 text-sm leading-relaxed text-muted">
            No classes yet. Create a class, or upload a lecture to get started.
          </p>
        ) : null}
        {filteredLectures
          .filter((l) => !l.classId)
          .map((lec) => (
            <LectureRow
              key={lec.id}
              lecture={lec}
              active={activeId === lec.id}
              renaming={renaming?.id === lec.id}
              menuOpen={menu === lec.id}
              onOpen={() => openLecture(lec.id)}
              onMenu={() => setMenu(menu === lec.id ? null : lec.id)}
              onRename={() => setRenaming({ kind: "lecture", id: lec.id })}
              onRenameSave={(name) => {
                rename("lecture", lec.id, name);
                setRenaming(null);
              }}
              onDelete={() => remove("lecture", lec.id)}
              moveTargets={[]}
              classTargets={data.classes}
              onMove={(folderId) => moveLecture(lec.id, folderId, null)}
              onMoveToClass={(id) => moveLecture(lec.id, null, id)}
            />
          ))}
        {data.classes.map((cls) => {
          const classFolders = data.folders.filter((f) => f.classId === cls.id && !f.parentFolderId);
          const classLectures = filteredLectures.filter((l) => l.classId === cls.id && !l.folderId);
          const open = !collapsed[cls.id];
          return (
            <div key={cls.id} className="mb-2">
              <Row
                icon="class"
                label={
                  renaming?.id === cls.id ? (
                    <RenameField
                      value={cls.name}
                      onSave={(name) => {
                        rename("class", cls.id, name);
                        setRenaming(null);
                      }}
                    />
                  ) : (
                    cls.name
                  )
                }
                open={open}
                onToggle={() => setCollapsed((c) => ({ ...c, [cls.id]: !c[cls.id] }))}
                onMenu={() => setMenu(menu === cls.id ? null : cls.id)}
                menuOpen={menu === cls.id}
                actions={[
                  { label: "New folder", onClick: () => setCreating({ folder: cls.id }) },
                  { label: "Rename", onClick: () => setRenaming({ kind: "class", id: cls.id }) },
                  { label: "Delete", onClick: () => remove("class", cls.id) },
                ]}
              />
              {open ? (
                <div className="ml-3 border-l border-line/80 pl-2">
                  {typeof creating === "object" && creating?.folder === cls.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (draft.trim()) createFolder(cls.id, draft.trim(), null);
                        setDraft("");
                        setCreating(null);
                      }}
                    >
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Folder name"
                        className="mb-1 w-full rounded-lg border border-line bg-paper px-2 py-1 text-sm"
                      />
                    </form>
                  ) : null}
                  {classFolders.map((folder) => (
                    <FolderBranch
                      key={folder.id}
                      folder={folder}
                      allFolders={data.folders}
                      lectures={filteredLectures}
                      depth={0}
                      activeId={activeId}
                      menu={menu}
                      setMenu={setMenu}
                      renaming={renaming}
                      setRenaming={setRenaming}
                      collapsed={collapsed}
                      setCollapsed={setCollapsed}
                      onOpen={openLecture}
                      onRename={rename}
                      onRemove={remove}
                      onCreateFolder={createFolder}
                      onMove={moveLecture}
                      classes={data.classes.map((c) => c.id)}
                      folders={data.folders}
                    />
                  ))}
                  {classLectures.map((lec) => (
                    <LectureRow
                      key={lec.id}
                      lecture={lec}
                      active={activeId === lec.id}
                      renaming={renaming?.id === lec.id}
                      menuOpen={menu === lec.id}
                      onOpen={() => openLecture(lec.id)}
                      onMenu={() => setMenu(menu === lec.id ? null : lec.id)}
                      onRename={() => setRenaming({ kind: "lecture", id: lec.id })}
                      onRenameSave={(name) => {
                        rename("lecture", lec.id, name);
                        setRenaming(null);
                      }}
                      onDelete={() => remove("lecture", lec.id)}
                      moveTargets={moveTargets(data.folders, cls.id)}
                      classTargets={data.classes.filter((c) => c.id !== cls.id)}
                      onMove={(folderId) => moveLecture(lec.id, folderId, cls.id)}
                      onMoveToClass={(id) => moveLecture(lec.id, null, id)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function moveTargets(folders: FolderRecord[], classId: string) {
  return folders.filter((f) => f.classId === classId);
}

function FolderBranch({
  folder,
  allFolders,
  lectures,
  depth,
  activeId,
  menu,
  setMenu,
  renaming,
  setRenaming,
  collapsed,
  setCollapsed,
  onOpen,
  onRename,
  onRemove,
  onCreateFolder,
  onMove,
  folders,
}: {
  folder: FolderRecord;
  allFolders: FolderRecord[];
  lectures: LectureRecord[];
  depth: number;
  activeId: string | null;
  menu: string | null;
  setMenu: (id: string | null) => void;
  renaming: { kind: string; id: string } | null;
  setRenaming: (v: { kind: "class" | "folder" | "lecture"; id: string } | null) => void;
  collapsed: Record<string, boolean>;
  setCollapsed: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onOpen: (id: string) => void;
  onRename: (kind: "class" | "folder" | "lecture", id: string, name: string) => void;
  onRemove: (kind: "class" | "folder" | "lecture", id: string) => void;
  onCreateFolder: (classId: string, name: string, parent: string | null) => void;
  onMove: (lectureId: string, folderId: string | null, classId: string | null) => void;
  classes: string[];
  folders: FolderRecord[];
}) {
  const [childName, setChildName] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const open = !collapsed[folder.id];
  const childFolders = allFolders.filter((f) => f.parentFolderId === folder.id);
  const childLectures = lectures.filter((l) => l.folderId === folder.id);

  return (
    <div>
      <Row
        icon="folder"
        label={
          renaming?.id === folder.id ? (
            <RenameField
              value={folder.name}
              onSave={(name) => {
                onRename("folder", folder.id, name);
                setRenaming(null);
              }}
            />
          ) : (
            folder.name
          )
        }
        open={open}
        onToggle={() => setCollapsed((c) => ({ ...c, [folder.id]: !c[folder.id] }))}
        onMenu={() => setMenu(menu === folder.id ? null : folder.id)}
        menuOpen={menu === folder.id}
        actions={[
          { label: "New folder", onClick: () => setChildName("") },
          { label: "Rename", onClick: () => setRenaming({ kind: "folder", id: folder.id }) },
          { label: "Delete", onClick: () => onRemove("folder", folder.id) },
        ]}
      />
      {open ? (
        <div className="ml-3 border-l border-line/70 pl-2">
          {childName !== null ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim()) onCreateFolder(folder.classId, draft.trim(), folder.id);
                setDraft("");
                setChildName(null);
              }}
            >
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="mb-1 w-full rounded-lg border border-line px-2 py-1 text-sm"
                placeholder="Folder name"
              />
            </form>
          ) : null}
          {childFolders.map((child) => (
            <FolderBranch
              key={child.id}
              folder={child}
              allFolders={allFolders}
              lectures={lectures}
              depth={depth + 1}
              activeId={activeId}
              menu={menu}
              setMenu={setMenu}
              renaming={renaming}
              setRenaming={setRenaming}
              collapsed={collapsed}
              setCollapsed={setCollapsed}
              onOpen={onOpen}
              onRename={onRename}
              onRemove={onRemove}
              onCreateFolder={onCreateFolder}
              onMove={onMove}
              classes={[]}
              folders={folders}
            />
          ))}
          {childLectures.map((lec) => (
            <LectureRow
              key={lec.id}
              lecture={lec}
              active={activeId === lec.id}
              renaming={renaming?.id === lec.id}
              menuOpen={menu === lec.id}
              onOpen={() => onOpen(lec.id)}
              onMenu={() => setMenu(menu === lec.id ? null : lec.id)}
              onRename={() => setRenaming({ kind: "lecture", id: lec.id })}
              onRenameSave={(name) => {
                onRename("lecture", lec.id, name);
                setRenaming(null);
              }}
              onDelete={() => onRemove("lecture", lec.id)}
              moveTargets={folders.filter((f) => f.classId === folder.classId && f.id !== folder.id)}
              classTargets={[]}
              onMove={(folderId) => onMove(lec.id, folderId, folder.classId)}
              onMoveToClass={(id) => onMove(lec.id, null, id)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LectureRow({
  lecture,
  active,
  renaming,
  menuOpen,
  onOpen,
  onMenu,
  onRename,
  onRenameSave,
  onDelete,
  moveTargets,
  classTargets = [],
  onMove,
  onMoveToClass,
}: {
  lecture: LectureRecord;
  active: boolean;
  renaming: boolean;
  menuOpen: boolean;
  onOpen: () => void;
  onMenu: () => void;
  onRename: () => void;
  onRenameSave: (name: string) => void;
  onDelete: () => void;
  moveTargets: FolderRecord[];
  classTargets?: ClassRecord[];
  onMove: (folderId: string | null) => void;
  onMoveToClass?: (classId: string) => void;
}) {
  return (
    <div className={`group relative flex items-center rounded-lg ${active ? "bg-accent/12 text-ink" : "hover:bg-paper/80"}`}>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm">
        <FileText size={14} className={active ? "text-accent" : "text-muted"} />
        {renaming ? <RenameField value={lecture.title} onSave={onRenameSave} /> : <span className="truncate">{lecture.title}</span>}
      </button>
      <button type="button" className="px-1 text-muted opacity-0 group-hover:opacity-100" onClick={onMenu}>
        <MoreHorizontal size={14} />
      </button>
      {menuOpen ? (
        <Menu
          actions={[
            { label: "Rename", onClick: onRename },
            { label: "Delete", onClick: onDelete },
            ...moveTargets.map((f) => ({ label: `Move to ${f.name}`, onClick: () => onMove(f.id) })),
            ...classTargets.map((c) => ({
              label: `Move to ${c.name}`,
              onClick: () => onMoveToClass?.(c.id),
            })),
            ...(lecture.classId ? [{ label: "Move to class root", onClick: () => onMove(null) }] : []),
          ]}
        />
      ) : null}
    </div>
  );
}

function Row({
  icon,
  label,
  open,
  onToggle,
  onMenu,
  menuOpen,
  actions,
}: {
  icon: "class" | "folder";
  label: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  onMenu: () => void;
  menuOpen: boolean;
  actions: { label: string; onClick: () => void }[];
}) {
  return (
    <div className="group relative flex items-center rounded-lg hover:bg-paper/80">
      <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-1 px-2 py-1.5 text-left text-sm font-medium">
        <ChevronRight size={14} className={`text-muted transition ${open ? "rotate-90" : ""}`} />
        {icon === "folder" ? <FolderPlus size={14} className="text-muted" /> : null}
        <span className="truncate">{label}</span>
      </button>
      <button type="button" className="px-1 text-muted opacity-0 group-hover:opacity-100" onClick={onMenu}>
        <MoreHorizontal size={14} />
      </button>
      {menuOpen ? <Menu actions={actions} /> : null}
    </div>
  );
}

function Menu({ actions }: { actions: { label: string; onClick: () => void }[] }) {
  return (
    <div className="absolute right-1 top-8 z-20 w-44 rounded-xl border border-line bg-paper py-1 shadow-lg">
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          className="block w-full px-3 py-1.5 text-left text-sm hover:bg-sidebar"
          onClick={a.onClick}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

function RenameField({ value, onSave }: { value: string; onSave: (name: string) => void }) {
  const [name, setName] = useState(value);
  return (
    <input
      autoFocus
      value={name}
      onChange={(e) => setName(e.target.value)}
      onBlur={() => onSave(name.trim() || value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSave(name.trim() || value);
      }}
      className="w-full rounded border border-line bg-paper px-1 text-sm"
    />
  );
}
