"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Sentinel for an open-ended block — an empty Select value is invalid. */
const INDEFINITE = "0";

const DURATIONS = [
  { value: INDEFINITE, label: "Until an admin lifts it" },
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "365", label: "1 year" },
];

/**
 * Collects the two things a block carries: how long, and why. The reason is an
 * operator's note — it is never shown to the blocked account, only on this
 * screen, so it can say what actually happened.
 *
 * Mounted only while it is open, so the caller's choice of account is also
 * what resets the form: a note typed for one person must never be carried into
 * the dialog for the next.
 */
export function UserBlockDialog({
  email,
  onCancel,
  onConfirm,
}: {
  email: string;
  onCancel: () => void;
  onConfirm: (input: { reason?: string; days?: number }) => void;
}) {
  const [reason, setReason] = useState("");
  const [days, setDays] = useState(INDEFINITE);

  return (
    <Dialog open onOpenChange={(next) => !next && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Block this account?</DialogTitle>
          <DialogDescription>
            {email} will be signed out everywhere and cannot sign in again until
            the block is lifted. Their puzzles stay in the library and their
            address stays taken, so this is not deletion and can be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="block-duration">Duration</Label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger id="block-duration" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="block-reason">Reason (optional)</Label>
            <Input
              id="block-reason"
              value={reason}
              maxLength={500}
              placeholder="Visible to admins only"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() =>
              onConfirm({
                reason: reason.trim() || undefined,
                days: days === INDEFINITE ? undefined : Number(days),
              })
            }
          >
            Block
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
