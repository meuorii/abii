"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast-provider";
import type { ToastKind } from "@/components/ui/toast-config";

const examples: { kind: ToastKind; label: string; title: string; message: string }[] = [
  { kind: "success", label: "Show Success Toast", title: "Card saved successfully!", message: "Your flashcard has been added to your deck. Keep up the great work!" },
  { kind: "warning", label: "Show Warning Toast", title: "Please check your input", message: "Some fields might be missing or incorrect. Kindly review and try again." },
  { kind: "info", label: "Show Information Toast", title: "Study tip!", message: "Try reviewing your cards regularly for better retention." },
  { kind: "error", label: "Show Error Toast", title: "Something went wrong", message: "Please try again in a moment. If the problem persists, check your connection." },
];

export function ToastShowcase() {
  const { toast } = useToast();
  return (
    <section className="mt-12 space-y-5" aria-labelledby="toast-heading">
      <div>
        <h2 id="toast-heading" className="text-xl font-bold text-foreground">Custom Toast Notifications</h2>
        <p className="mt-1 text-sm text-muted">Friendly feedback, powered by Abii.</p>
      </div>
      <Card className="flex flex-wrap gap-3">
        {examples.map((example) => <Button key={example.kind} type="button" variant="outline" onClick={() => toast({ kind: example.kind, title: example.title, message: example.message })}>{example.label}</Button>)}
      </Card>
    </section>
  );
}
