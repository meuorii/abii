import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorMessage, EmptyState, LoadingState } from "@/components/ui/feedback";
import { Flashcard } from "@/components/ui/flashcard";
import { TextArea, TextInput } from "@/components/ui/input";
import { Navigation } from "@/components/ui/navigation";
import { MascotDisplay } from "@/components/ui/mascot-display";
import { Mascot, type MascotState } from "@/components/ui/mascot";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ToastShowcase } from "@/components/ui/toast-showcase";
import { ModalShowcase } from "@/components/ui/modal-showcase";

const swatches = [
  ["White", "#FFFFFF", "bg-white"],
  ["Light pink", "#FFF7F9", "bg-pink-soft"],
  ["Pink card", "#FFE8EF", "bg-pink-card"],
  ["Soft pink", "#FFC9D8", "bg-pink"],
  ["Accent", "#FF9FBA", "bg-pink-accent"],
  ["Primary", "#FF6F96", "bg-pink-primary"],
  ["Active", "#E9577D", "bg-pink-active"],
  ["Text", "#2F2930", "bg-foreground"],
  ["Secondary text", "#756B72", "bg-muted"],
  ["Border", "#E8E2E5", "bg-border"],
  ["Success", "#EAF8F0", "bg-success"],
  ["Error", "#FFF1F1", "bg-error"],
];

export default function DesignSystemPage() {
  return (
    <main className="min-h-screen bg-white">
      <Navigation
        items={[
          { label: "Overview", href: "/", active: false },
          { label: "Design system", href: "/design-system", active: true },
        ]}
      />
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-pink-active">Abii UI foundations</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">A little design, a lot of clarity.</h1>
          <p className="mt-4 text-base leading-7 text-muted">
            Reusable pieces for a calm, friendly study space. This page is a visual playground for the shared components—not a finished app screen.
          </p>
        </div>

        <section className="mt-12 space-y-5" aria-labelledby="colors-heading">
          <div>
            <h2 id="colors-heading" className="text-xl font-bold text-foreground">Color palette</h2>
            <p className="mt-1 text-sm text-muted">Mostly white surfaces, with pink used to guide attention.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {swatches.map(([name, hex, colorClass]) => (
              <div key={name} className="overflow-hidden rounded-2xl border border-border bg-white">
                <div className={["h-16 border-b border-border", colorClass].join(" ")} />
                <div className="p-3">
                  <p className="text-sm font-semibold text-foreground">{name}</p>
                  <p className="mt-1 text-xs text-muted">{hex}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 space-y-5" aria-labelledby="buttons-heading">
          <div>
            <h2 id="buttons-heading" className="text-xl font-bold text-foreground">Buttons</h2>
            <p className="mt-1 text-sm text-muted">Clear hierarchy, soft corners, visible keyboard focus.</p>
          </div>
          <Card className="flex flex-wrap items-center gap-3">
            <Button>Primary action</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Remove</Button>
            <Button size="sm" variant="outline">Small</Button>
            <Button size="lg">Large action</Button>
            <Button disabled>Disabled</Button>
          </Card>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-2" aria-label="Cards and form fields">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Cards</h2>
            <Card>
              <CardHeader>
                <CardTitle>Biology basics</CardTitle>
                <CardDescription>Chapter 1 · 12 flashcards</CardDescription>
              </CardHeader>
              <ProgressBar value={8} max={12} label="Cards reviewed" />
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                <span className="text-sm text-muted">8 of 12 practiced</span>
                <Button size="sm" variant="outline">Continue</Button>
              </div>
            </Card>
          </div>
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Form fields</h2>
            <Card>
              <div className="space-y-4">
                <TextInput label="Subject name" name="subject-name" placeholder="e.g. Biology" hint="Choose a name you’ll recognize." />
                <TextArea label="Flashcard question" name="question" placeholder="What do you want to remember?" />
                <TextInput label="Example validation" name="email-example" placeholder="name@example.com" error="Please enter a valid email address." />
                <Button type="button">Save example</Button>
              </div>
            </Card>
          </div>
        </section>

        <section className="mt-12 space-y-5" aria-labelledby="flashcard-heading">
          <div>
            <h2 id="flashcard-heading" className="text-xl font-bold text-foreground">Flashcard</h2>
            <p className="mt-1 text-sm text-muted">Question stays prominent; hint and answer are visually distinct.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Flashcard
              subject="BIOLOGY · IDENTIFICATION"
              question="What is the basic unit of life?"
              hint="Think of the smallest building block of living things."
            />
            <Flashcard
              subject="BIOLOGY · IDENTIFICATION"
              question="What is the basic unit of life?"
              hint="Think of the smallest building block of living things."
              answer="The cell."
              footer={<div className="flex flex-wrap gap-2"><Button size="sm">Correct</Button><Button size="sm" variant="outline">Need to review</Button></div>}
            />
          </div>
        </section>

        <section className="mt-12 space-y-5" aria-labelledby="feedback-heading">
          <div>
            <h2 id="feedback-heading" className="text-xl font-bold text-foreground">Feedback and states</h2>
            <p className="mt-1 text-sm text-muted">Helpful messages for waiting, errors, and empty screens.</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardTitle>Loading</CardTitle>
              <div className="mt-4"><LoadingState message="Loading your study cards…" /></div>
            </Card>
            <Card>
              <CardTitle>Error</CardTitle>
              <div className="mt-4"><ErrorMessage title="Couldn’t save this card" message="Check your connection and try again." /></div>
            </Card>
            <Card>
              <CardTitle>Empty state</CardTitle>
              <div className="mt-4"><EmptyState title="No flashcards yet" message="Create your first card to start practicing active recall." action={<Button>Create a flashcard</Button>} /></div>
            </Card>
            <Card>
              <CardTitle>Mascot moods</CardTitle>
              <div className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3">
                {(["welcome", "correct", "wrong", "review-reminder", "complete", "empty"] as MascotState[]).map((state) => (
                  <div key={state} className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-border bg-white p-3 text-center">
                    <Mascot state={state} size="sm" />
                    <span className="text-xs font-medium text-muted">{state}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-5 text-muted">If an image is missing, a neutral Abii fallback appears. Add your six original image files to <code>public/mascot/</code> using the filenames listed in the README.</p>
            </Card>
          </div>
        </section>

        <ToastShowcase />

        <ModalShowcase />

        <footer className="mt-14 border-t border-border pt-6 text-sm text-muted">
          Abii · Learn a little, remember a lot.
        </footer>
      </div>
    </main>
  );
}
