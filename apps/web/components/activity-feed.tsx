"use client";

import { useState } from "react";
import {
  Bot,
  CheckCircle2,
  Lightbulb,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Info,
  FileText,
  FolderKanban,
  Workflow,
  Link as LinkIcon,
  ChevronRight,
  X,
  Clock,
  User,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/time";
import type { ActivityEvent, Agent } from "@/lib/types";
import { listActivityEvents } from "@/app/activity/actions";

interface ActivityFeedProps {
  agents?: Agent[];
  embedded?: boolean;
  initialEvents: ActivityEvent[];
}

const severityConfig = {
  info: { icon: Info, variant: "secondary" as const },
  warning: { icon: AlertTriangle, variant: "default" as const },
  error: { icon: AlertCircle, variant: "destructive" as const },
  critical: { icon: XCircle, variant: "destructive" as const },
} as const;

function getSourceIcon(source: ActivityEvent["source"]) {
  switch (source) {
    case "agent":
      return Bot;
    case "user":
      return User;
    case "sync":
      return RefreshCw;
    case "workflow":
      return Workflow;
    case "hook":
      return LinkIcon;
    default:
      return Info;
  }
}

function getEntityIcon(event: ActivityEvent) {
  if (event.entityType) {
    switch (event.entityType.toLowerCase()) {
      case "task":
        return CheckCircle2;
      case "idea":
        return Lightbulb;
      case "project":
        return FolderKanban;
      case "agent":
        return Bot;
      default:
        return FileText;
    }
  }
  return FileText;
}

function getSeverityBadgeVariant(severity: ActivityEvent["severity"]) {
  switch (severity) {
    case "info":
      return "secondary";
    case "warning":
      return "default";
    case "error":
    case "critical":
      return "destructive";
  }
}

export function ActivityFeed({
  agents,
  embedded = false,
  initialEvents,
}: ActivityFeedProps): React.JSX.Element {
  type ActivityFilterState = {
    agentId: string;
    type: string;
    severity: "" | ActivityEvent["severity"];
    entityType: string;
  };

  const [events, setEvents] = useState<ActivityEvent[]>(initialEvents);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ActivityEvent | null>(null);
  const [filters, setFilters] = useState<ActivityFilterState>({
    agentId: "",
    type: "",
    severity: "",
    entityType: "",
  });

  const fetchEvents = async (nextFilters: ActivityFilterState) => {
    setLoading(true);
    try {
      const data = await listActivityEvents({
        agentId: nextFilters.agentId || undefined,
        type: nextFilters.type || undefined,
        severity: nextFilters.severity || undefined,
        entityType: nextFilters.entityType || undefined,
      });
      setEvents(data);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    const nextFilters: ActivityFilterState = {
      agentId: "",
      type: "",
      severity: "",
      entityType: "",
    };
    setFilters(nextFilters);
    void fetchEvents(nextFilters);
  };

  const updateFilters = (partial: Partial<typeof filters>) => {
    setFilters((current) => {
      const nextFilters = { ...current, ...partial };
      void fetchEvents(nextFilters);
      return nextFilters;
    });
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  return (
    <>
      <Card className={embedded ? "" : "h-full"}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Activity Feed</CardTitle>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-6 text-xs"
              >
                Clear filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-4 space-y-2">
            <div className="flex flex-wrap gap-2">
              {/* Agent filter */}
              <select
                aria-label="Filter by agent"
                value={filters.agentId}
                onChange={(e) => updateFilters({ agentId: e.target.value })}
                className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">All Agents</option>
                {agents?.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>

              {/* Severity filter */}
              <select
                aria-label="Filter by severity"
                value={filters.severity}
                onChange={(e) =>
                  updateFilters({
                    severity: e.target.value as ActivityEvent["severity"] | "",
                  })
                }
                className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">All Severities</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="critical">Critical</option>
              </select>

              {/* Entity type filter */}
              <select
                aria-label="Filter by entity type"
                value={filters.entityType}
                onChange={(e) => updateFilters({ entityType: e.target.value })}
                className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">All Entities</option>
                <option value="task">Tasks</option>
                <option value="idea">Ideas</option>
                <option value="project">Projects</option>
                <option value="agent">Agents</option>
              </select>

              {/* Type filter */}
              <select
                aria-label="Filter by event type"
                value={filters.type}
                onChange={(e) => updateFilters({ type: e.target.value })}
                className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">All Types</option>
                <option value="task.created">Task Created</option>
                <option value="task.updated">Task Updated</option>
                <option value="task.completed">Task Completed</option>
                <option value="idea.created">Idea Created</option>
                <option value="idea.promoted">Idea Promoted</option>
                <option value="project.created">Project Created</option>
                <option value="project.updated">Project Updated</option>
                <option value="agent.registered">Agent Registered</option>
                <option value="sync.completed">Sync Completed</option>
              </select>
            </div>
          </div>

          {/* Feed */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Info className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters
                  ? "No events match your filters"
                  : "No recent activity"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                const SeverityIcon = severityConfig[event.severity].icon;
                const SourceIcon = getSourceIcon(event.source);
                const EntityIcon = getEntityIcon(event);

                return (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className="w-full text-left"
                  >
                    <div className="group flex items-start gap-3 rounded-lg border border-transparent p-2 transition-colors hover:bg-accent">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <SeverityIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {event.title}
                          </span>
                          <Badge
                            variant={getSeverityBadgeVariant(event.severity)}
                            className="h-4 text-[10px]"
                          >
                            {event.severity}
                          </Badge>
                        </div>
                        {event.body && (
                          <span className="text-xs text-muted-foreground line-clamp-1">
                            {event.body}
                          </span>
                        )}
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <SourceIcon className="h-3 w-3" />
                            {event.source}
                          </span>
                          {event.entityType && (
                            <span className="flex items-center gap-1">
                              <EntityIcon className="h-3 w-3" />
                              {event.entityType}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {timeAgo(event.createdAt)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Detail Panel */}
      {selectedEvent && (
        <EventDetailPanel
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </>
  );
}

interface EventDetailPanelProps {
  event: ActivityEvent;
  onClose: () => void;
}

function EventDetailPanel({
  event,
  onClose,
}: EventDetailPanelProps): React.JSX.Element {
  const SeverityIcon = severityConfig[event.severity].icon;
  const SourceIcon = getSourceIcon(event.source);
  const EntityIcon = getEntityIcon(event);

  let metadata: Record<string, unknown> = {};
  if (event.metadata) {
    try {
      metadata = JSON.parse(event.metadata);
    } catch {
      // Ignore parse errors
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl bg-card shadow-xl">
        {/* Header */}
        <div className="sticky top-0 flex items-start justify-between border-b border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <SeverityIcon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{event.title}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <SourceIcon className="h-3 w-3" />
                  {event.source}
                </span>
                <span>•</span>
                <span>{new Date(event.createdAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="space-y-4 p-4">
          {/* Severity and Type */}
          <div className="flex flex-wrap gap-2">
            <Badge variant={getSeverityBadgeVariant(event.severity)}>
              {event.severity}
            </Badge>
            <Badge variant="outline">{event.type}</Badge>
            {event.entityType && (
              <Badge variant="outline" className="flex items-center gap-1">
                <EntityIcon className="h-3 w-3" />
                {event.entityType}
              </Badge>
            )}
          </div>

          {/* Body */}
          {event.body && (
            <div>
              <h4 className="text-sm font-medium mb-2">Description</h4>
              <p className="text-sm text-muted-foreground">{event.body}</p>
            </div>
          )}

          {/* Entity References */}
          {(event.entityId || event.projectId || event.taskId || event.agentId) && (
            <div>
              <h4 className="text-sm font-medium mb-2">Related Entities</h4>
              <div className="grid grid-cols-2 gap-2">
                {event.agentId && (
                  <div className="rounded-lg border border-border bg-muted p-2">
                    <div className="text-xs text-muted-foreground">Agent</div>
                    <div className="text-sm font-medium truncate">
                      {event.agentId}
                    </div>
                  </div>
                )}
                {event.projectId && (
                  <div className="rounded-lg border border-border bg-muted p-2">
                    <div className="text-xs text-muted-foreground">Project</div>
                    <div className="text-sm font-medium truncate">
                      {event.projectId}
                    </div>
                  </div>
                )}
                {event.taskId && (
                  <div className="rounded-lg border border-border bg-muted p-2">
                    <div className="text-xs text-muted-foreground">Task</div>
                    <div className="text-sm font-medium truncate">
                      {event.taskId}
                    </div>
                  </div>
                )}
                {event.entityId && (
                  <div className="rounded-lg border border-border bg-muted p-2">
                    <div className="text-xs text-muted-foreground">Entity</div>
                    <div className="text-sm font-medium truncate">
                      {event.entityId}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Metadata */}
          {Object.keys(metadata).length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Metadata</h4>
              <pre className="rounded-lg border border-border bg-muted p-3 text-xs overflow-x-auto">
                {JSON.stringify(metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
