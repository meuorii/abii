"use client";

import { useMemo, useState } from "react";
import { Award, Bell, BookOpen, ChartNoAxesColumn, ChevronRight, Folder, FolderOpen, LayoutDashboard, PanelLeft, RotateCcw, Search, Settings } from "lucide-react";
import { demoFolders } from "@/components/landing/demo-data";

export function StudyWorkspacePreview() {
  const [selected, setSelected] = useState(0);
  const [query, setQuery] = useState("");
  const folder = demoFolders[selected];
  const visibleFolders = useMemo(() => demoFolders.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase())), [query]);
  return <div className="workspace-frame" aria-label="Illustrative Biology Basics study workspace">
    <aside className="workspace-sidebar" aria-label="Illustrative app navigation">
      <a href="#home" className="workspace-logo"><span className="font-brand">abii</span><span className="workspace-period">.</span></a>
      <nav><span className="workspace-nav-item"><LayoutDashboard />Dashboard</span><span className="workspace-nav-item is-active"><BookOpen />My Subjects</span><span className="workspace-nav-item"><RotateCcw />Review</span><span className="workspace-nav-item"><ChartNoAxesColumn />Progress</span><span className="workspace-nav-item"><Award />Badges</span><span className="workspace-nav-item"><Settings />Settings</span></nav>
      <p className="workspace-sidebar-note">Small steps,<br/>big progress.</p>
    </aside>
    <div className="workspace-main">
      <div className="workspace-topbar"><span className="workspace-mobile-mark"><PanelLeft aria-hidden="true"/> My Subjects</span><span className="workspace-notifications" aria-hidden="true"><Bell/></span><span className="workspace-avatar" aria-label="Illustrative profile">A</span></div>
      <div className="workspace-content">
        <div className="workspace-crumb">My Subjects <ChevronRight aria-hidden="true"/> Biology Basics</div>
        <div className="workspace-title-row"><div><h3>Biology Basics</h3><p>Organize your topics and keep learning.</p></div><span className="demo-chip">Demo Preview</span></div>
        <div className="workspace-controls"><label><Search aria-hidden="true"/><span className="sr-only">Search folders</span><input placeholder="Search folders..." value={query} onChange={(event) => setQuery(event.target.value)} /></label><span className="workspace-topic-total">4 folders <span>·</span> 18 topics</span></div>
        <div className="workspace-body">
          <div className="folder-list" role="group" aria-label="Choose a sample folder" aria-live="polite">{visibleFolders.length ? visibleFolders.map((item) => { const index = demoFolders.findIndex((folderItem) => folderItem.name === item.name); return <button key={item.name} type="button" onClick={() => setSelected(index)} aria-pressed={index === selected} className={`folder-row${index === selected ? " selected" : ""}`}><span className="folder-icon">{index === selected ? <FolderOpen/> : <Folder/>}</span><span className="folder-copy"><strong>{item.name}</strong><small>{item.count} topics</small></span><ChevronRight aria-hidden="true" className="folder-chevron"/></button>; }) : <p className="workspace-empty">No matching folders.</p>}</div>
          <section className="topic-panel" aria-live="polite" aria-labelledby="topic-panel-title"><div className="topic-panel-head"><div><span className="topic-kicker">Biology Basics / Folder</span><h4 id="topic-panel-title">{folder.name}</h4></div><span className="topic-count">{folder.count} topics</span></div><ul>{folder.topics.map((topic, index) => <li key={topic}><span className="topic-bullet"><BookOpen aria-hidden="true"/></span><span>{topic}</span><span className="topic-index">{String(index + 1).padStart(2, "0")}</span></li>)}</ul></section>
        </div>
      </div>
    </div>
  </div>;
}
