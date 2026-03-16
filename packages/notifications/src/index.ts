import { eq, desc, count } from "drizzle-orm";
import type { DBOrTx, Notification } from "@clawops/core";
import { notifications } from "@clawops/core";
import { generateId } from "@clawops/domain";

interface CreateNotificationInput {
  type: string;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
}

interface ListNotificationFilters {
  read?: boolean;
}

export function createNotification(
  db: DBOrTx,
  input: CreateNotificationInput,
): Notification {
  const [notification] = db
    .insert(notifications)
    .values({
      id: generateId(),
      type: input.type,
      title: input.title,
      body: input.body,
      entityType: input.entityType,
      entityId: input.entityId,
    })
    .returning()
    .all();
  return notification;
}

export function listNotifications(
  db: DBOrTx,
  filters?: ListNotificationFilters,
): Notification[] {
  const query = db.select().from(notifications);

  if (filters?.read !== undefined) {
    return query
      .where(eq(notifications.read, filters.read))
      .orderBy(desc(notifications.createdAt))
      .all();
  }

  return query.orderBy(desc(notifications.createdAt)).all();
}

export function markRead(db: DBOrTx, id: string): Notification {
  const [notification] = db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.id, id))
    .returning()
    .all();
  return notification;
}

export function markAllRead(db: DBOrTx): void {
  db.update(notifications)
    .set({ read: true })
    .where(eq(notifications.read, false))
    .run();
}

export function getUnreadCount(db: DBOrTx): number {
  const [result] = db
    .select({ value: count() })
    .from(notifications)
    .where(eq(notifications.read, false))
    .all();
  return result.value;
}
