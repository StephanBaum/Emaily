import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ComposerHeaderProps {
  replyTo: string;
  onClose: () => void;
}

export function ComposerHeader({ replyTo, onClose }: ComposerHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <div className="text-sm text-muted-foreground">
        Replying to <span className="font-medium">{replyTo}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
