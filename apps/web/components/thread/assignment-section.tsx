"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  UserPlus,
  MoreVertical,
  Trash2,
  ChevronDown,
  Circle,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { getInitials } from "@/lib/format";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Assignment {
  id: string;
  status: string;
  note: string | null;
  dueDate: string | null;
  createdAt: string;
  assignedTo: {
    id: string;
    name: string;
    email: string;
  };
  assignedBy: {
    id: string;
    name: string;
    email: string;
  };
}

interface AssignmentSectionProps {
  threadId: string;
  initialAssignments: Assignment[];
  teamMembers: TeamMember[];
}

const STATUS_CONFIG = {
  open: {
    label: "Open",
    icon: Circle,
    variant: "outline" as const,
  },
  in_progress: {
    label: "In Progress",
    icon: Clock,
    variant: "secondary" as const,
  },
  done: {
    label: "Done",
    icon: CheckCircle2,
    variant: "default" as const,
  },
};

export function AssignmentSection({
  threadId,
  initialAssignments,
  teamMembers,
}: AssignmentSectionProps) {
  const { data: session } = useSession();
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync server-rendered props to local state
  useEffect(() => {
    setAssignments(initialAssignments);
  }, [initialAssignments]);

  const assignedUserIds = new Set(assignments.map((a) => a.assignedTo.id));
  const availableMembers = teamMembers.filter((m) => !assignedUserIds.has(m.id));

  async function handleAssign(userId: string) {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/threads/${threadId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: userId }),
      });

      if (res.ok) {
        const assignment = await res.json();
        setAssignments([assignment, ...assignments]);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStatusChange(assignmentId: string, newStatus: string) {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/threads/${threadId}/assignments/${assignmentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (res.ok) {
        const updated = await res.json();
        setAssignments(
          assignments.map((a) => (a.id === assignmentId ? updated : a))
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(assignmentId: string) {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/threads/${threadId}/assignments/${assignmentId}`,
        {
          method: "DELETE",
        }
      );

      if (res.ok) {
        setAssignments(assignments.filter((a) => a.id !== assignmentId));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Assign Button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            disabled={isSubmitting || availableMembers.length === 0}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Assign
            <ChevronDown className="ml-auto h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {availableMembers.length === 0 ? (
            <DropdownMenuItem disabled>
              All team members assigned
            </DropdownMenuItem>
          ) : (
            availableMembers.map((member) => (
              <DropdownMenuItem
                key={member.id}
                onClick={() => handleAssign(member.id)}
              >
                <Avatar className="mr-2 h-6 w-6">
                  <AvatarFallback className="text-[10px]">
                    {getInitials(member.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm">{member.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {member.email}
                  </span>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Assignment List */}
      {assignments.length > 0 && (
        <div className="space-y-2">
          {assignments.map((assignment) => {
            const statusConfig = STATUS_CONFIG[assignment.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.open;
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={assignment.id}
                className="group flex items-start gap-2 rounded-md bg-background p-2"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-[10px]">
                    {getInitials(assignment.assignedTo.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {assignment.assignedTo.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {/* Status Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant={statusConfig.variant}
                          size="sm"
                          className="h-6 px-2 text-xs"
                        >
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {statusConfig.label}
                          <ChevronDown className="ml-1 h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                          const Icon = config.icon;
                          return (
                            <DropdownMenuItem
                              key={key}
                              onClick={() => handleStatusChange(assignment.id, key)}
                              className={assignment.status === key ? "bg-muted" : ""}
                            >
                              <Icon className="mr-2 h-4 w-4" />
                              {config.label}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <span className="text-xs text-muted-foreground">
                      by {assignment.assignedBy.name.split(" ")[0]}
                    </span>
                  </div>
                </div>
                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDelete(assignment.id)}
                    >
                      <Trash2 className="mr-2 h-3 w-3" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      {assignments.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          No one assigned yet
        </p>
      )}
    </div>
  );
}
