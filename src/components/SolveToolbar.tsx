"use client";

import {
  CheckIcon,
  CopyIcon,
  EyeIcon,
  KeyboardIcon,
  PrinterIcon,
  RotateCcwIcon,
  Share2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Messages } from "@/lib/i18n";

export function SolveToolbar({
  t,
  canRevealWord,
  onCheck,
  onRevealWord,
  onReset,
  onCopyLink,
  shareUrl,
  printHref,
}: {
  t: Messages["solve"];
  canRevealWord: boolean;
  onCheck: () => void;
  onRevealWord: () => void;
  onReset: () => void;
  onCopyLink: () => void;
  shareUrl: string;
  printHref: string;
}) {
  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={onCheck}>
        <CheckIcon />
        {t.check}
      </Button>
      <Button variant="outline" size="sm" onClick={onRevealWord} disabled={!canRevealWord}>
        <EyeIcon />
        {t.revealWord}
      </Button>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Share2Icon />
            {t.share}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.shareTitle}</DialogTitle>
            <DialogDescription>{t.shareDescription}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly defaultValue={shareUrl} onFocus={(e) => e.target.select()} />
            <Button onClick={onCopyLink}>
              <CopyIcon />
              {t.copyLink}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm">
            <RotateCcwIcon />
            {t.reset}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.resetTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.resetDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={onReset}>{t.resetConfirm}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button variant="ghost" size="sm" asChild>
        <a href={printHref}>
          <PrinterIcon />
          {t.printVersion}
        </a>
      </Button>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t.keyboardHint}>
            <KeyboardIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t.keyboardHint}</TooltipContent>
      </Tooltip>
    </div>
  );
}
