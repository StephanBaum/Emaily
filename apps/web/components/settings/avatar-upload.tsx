"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, Loader2 } from "lucide-react";

interface AvatarUploadProps {
  userId: string;
  userName: string;
  hasAvatar: boolean;
  onAvatarChange: () => void;
}

export function AvatarUpload({
  userId,
  userName,
  hasAvatar,
  onAvatarChange,
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(
    hasAvatar ? `/api/user/avatar/${userId}?t=${Date.now()}` : null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const resized = await resizeImage(file, 200, 200);
      const res = await fetch("/api/user/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: resized.base64,
          mimeType: resized.mimeType,
        }),
      });

      if (res.ok) {
        setAvatarUrl(`/api/user/avatar/${userId}?t=${Date.now()}`);
        onAvatarChange();
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      const res = await fetch("/api/user/avatar", { method: "DELETE" });
      if (res.ok) {
        setAvatarUrl(null);
        onAvatarChange();
      }
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-20 w-20 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-2xl font-semibold text-primary">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={userName}
            className="h-full w-full object-cover"
          />
        ) : (
          initials
        )}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          Upload
        </Button>
        {avatarUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRemove}
            disabled={removing}
          >
            {removing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Remove
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    </div>
  );
}

async function resizeImage(
  file: File,
  maxWidth: number,
  maxHeight: number
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
      const dataUrl = canvas.toDataURL(mimeType, 0.85);
      const base64 = dataUrl.split(",")[1];
      resolve({ base64, mimeType });
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
