import "server-only";

import { getDb } from "@/lib/server/runtime";
import { listTasks } from "@clawops/tasks";
import { listIdeas } from "@clawops/ideas";
import { getUnreadCount } from "@clawops/notifications";
import { Sidebar, type SidebarCounts } from "@/components/sidebar";

export async function SidebarWrapper(): Promise<React.JSX.Element> {
  let counts: SidebarCounts = { tasks: 0, ideas: 0, notifications: 0 };

  try {
    const db = getDb();

    // Active tasks (non-done, non-cancelled)
    const allTasks = listTasks(db);
    const activeTasks = allTasks.filter(
      (t) => t.status !== "done" && t.status !== "cancelled",
    );

    // Unreviewed ideas (raw or reviewed, not promoted/archived)
    const allIdeas = listIdeas(db);
    const unreviewedIdeas = allIdeas.filter(
      (i) => i.status === "raw" || i.status === "reviewed",
    );

    // Unread notifications
    const unreadCount = getUnreadCount(db);

    counts = {
      tasks:         activeTasks.length,
      ideas:         unreviewedIdeas.length,
      notifications: unreadCount,
    };
  } catch {
    // Silently fail — counts are non-critical UI
  }

  return <Sidebar counts={counts} />;
}
