"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MailboxForm } from "@/components/settings/mailbox-form";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Mail,
  Server,
} from "lucide-react";

interface MailboxSummary {
  id: string;
  emailAddress: string;
  displayName: string;
  type: string;
  imapHost: string | null;
  smtpHost: string | null;
  _count: { threads: number };
}

interface MailboxDetail {
  id: string;
  emailAddress: string;
  displayName: string;
  type: string;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  signature: string | null;
  folderInbox: string;
  folderArchive: string;
  folderTrash: string;
  folderDrafts: string;
  folderSent: string;
  folderSpam: string;
}

export default function MailboxesPage() {
  const [mailboxes, setMailboxes] = useState<MailboxSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<MailboxDetail | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchMailboxes = useCallback(async () => {
    try {
      const res = await fetch("/api/mailboxes");
      if (res.ok) {
        const data = await res.json();
        setMailboxes(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMailboxes();
  }, [fetchMailboxes]);

  async function handleEdit(id: string) {
    setLoadingEdit(true);
    setEditId(id);
    try {
      const res = await fetch(`/api/mailboxes/${id}`);
      if (res.ok) {
        const data = await res.json();
        setEditData(data);
        setShowForm(true);
      }
    } finally {
      setLoadingEdit(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/mailboxes/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMailboxes((prev) => prev.filter((m) => m.id !== id));
        setConfirmDeleteId(null);
      }
    } finally {
      setDeletingId(null);
    }
  }

  function handleFormSuccess() {
    setShowForm(false);
    setEditId(null);
    setEditData(null);
    setLoading(true);
    fetchMailboxes();
  }

  function handleFormCancel() {
    setShowForm(false);
    setEditId(null);
    setEditData(null);
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Mailboxes</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading mailboxes...
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">
          {editId ? "Edit Mailbox" : "Add Mailbox"}
        </h1>
        <MailboxForm
          mode={editId ? "edit" : "create"}
          mailboxId={editId || undefined}
          initialData={
            editData
              ? {
                  emailAddress: editData.emailAddress,
                  displayName: editData.displayName || "",
                  type: editData.type,
                  imapHost: editData.imapHost || "",
                  imapPort: editData.imapPort || 993,
                  imapUser: editData.imapUser || "",
                  imapPassword: "",
                  smtpHost: editData.smtpHost || "",
                  smtpPort: editData.smtpPort || 587,
                  smtpUser: editData.smtpUser || "",
                  smtpPassword: "",
                  signature: editData.signature || "",
                  folderInbox: editData.folderInbox,
                  folderArchive: editData.folderArchive,
                  folderTrash: editData.folderTrash,
                  folderDrafts: editData.folderDrafts,
                  folderSent: editData.folderSent,
                  folderSpam: editData.folderSpam,
                }
              : undefined
          }
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Mailboxes</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Mailbox
        </Button>
      </div>

      {mailboxes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No mailboxes configured</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add your first mailbox to start managing email.
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Mailbox
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {mailboxes.map((mailbox) => (
            <Card key={mailbox.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">
                      {mailbox.displayName || mailbox.emailAddress}
                    </CardTitle>
                    <Badge
                      variant={
                        mailbox.type === "shared" ? "default" : "secondary"
                      }
                    >
                      {mailbox.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(mailbox.id)}
                      disabled={loadingEdit && editId === mailbox.id}
                    >
                      {loadingEdit && editId === mailbox.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Pencil className="h-4 w-4" />
                      )}
                    </Button>

                    {confirmDeleteId === mailbox.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-destructive">
                          Delete?
                        </span>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(mailbox.id)}
                          disabled={deletingId === mailbox.id}
                        >
                          {deletingId === mailbox.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Yes"
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          No
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDeleteId(mailbox.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" />
                    <span>{mailbox.emailAddress}</span>
                  </div>
                  {(mailbox.imapHost || mailbox.smtpHost) && (
                    <div className="flex items-center gap-2">
                      <Server className="h-3.5 w-3.5" />
                      <span>
                        {[mailbox.imapHost, mailbox.smtpHost]
                          .filter(Boolean)
                          .join(" / ")}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
