import Link from "next/link";
import { ArrowDown, Check, CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorMessage, EmptyState, LoadingState } from "@/components/ui/feedback";
import { Flashcard } from "@/components/ui/flashcard";
import { TextArea, TextInput } from "@/components/ui/input";
import { Navigation } from "@/components/ui/navigation";
import { Mascot, type MascotState } from "@/components/ui/mascot";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ToastShowcase } from "@/components/ui/toast-showcase";
import { ModalShowcase } from "@/components/ui/modal-showcase";
import { adminChartColors } from "@/components/admin/chart-colors";

const colorGroups = [
  { title: "Foundation · 60%", note: "Warm page backgrounds lead; the frame color is a supporting structural neutral.", colors: [["Main background", "#FFF9FC"], ["Dashboard outer frame", "#FFF4F8"], ["Card surface", "#FFFFFF"], ["Border / divider", "#E8DDE1"]] },
  { title: "Support · 30%", note: "Blush surfaces add warmth and frame important content.", colors: [["Secondary surface", "#FFE8EF"], ["Subtle hover", "#FFF1F5"], ["Selected surface", "#FFE8EF"]] },
  { title: "Brand · 10%", note: "Use the original Abii pink for primary actions and brand moments.", colors: [["Primary", "#F8769C"], ["Hover", "#EC658D"], ["Pressed", "#D9547D"]] },
];

const semantic = [
  { name: "Success", hex: "#5C947A", bg: "#EDF5EF", text: "#3D7259", icon: CircleCheck, message: "Your progress has been saved." },
  { name: "Warning", hex: "#B28A54", bg: "#FBF3E7", text: "#8A683B", icon: TriangleAlert, message: "A few answers still need a review." },
  { name: "Error", hex: "#C76F7D", bg: "#FCECEF", text: "#A94D61", icon: CircleAlert, message: "We couldn’t save this change." },
];

const typography = [
  ["Primary text", "#30262B", "Headings, labels, and high-priority content"],
  ["Secondary text", "#6F5964", "Supporting copy and descriptions"],
];

const chartSwatches = [
  ["Primary series", adminChartColors.primary],
  ["Secondary series", adminChartColors.secondary],
  ["Tertiary series", adminChartColors.tertiary],
  ["Chart area fill", adminChartColors.fill],
] as const;

export default function DesignSystemPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navigation items={[{ label: "Home", href: "/", active: false }, { label: "Design system", href: "/design-system", active: true }]} />
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-8 sm:pt-10">
        <section className="relative isolate overflow-hidden rounded-[2rem] bg-secondary-surface px-6 py-10 sm:px-10 sm:py-14 lg:px-14" aria-labelledby="hero-heading">
          <div className="relative z-10 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-hover">Abii design system · v1.1</p>
            <h1 id="hero-heading" className="mt-4 max-w-[15ch] text-4xl font-extrabold leading-[1.06] tracking-[-0.045em] text-foreground sm:text-5xl lg:text-6xl">A little design. A lot of personality.</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">A thoughtful visual language that makes every learning moment feel warm, simple, and unmistakably Abii.</p>
            <Link href="#palette" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover active:bg-primary-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover focus-visible:ring-offset-2">Explore the system <ArrowDown size={16} aria-hidden="true" /></Link>
          </div>
          <div className="pointer-events-none absolute -bottom-10 right-0 h-56 w-44 opacity-95 sm:right-6 sm:h-72 sm:w-60 lg:right-10 lg:h-80 lg:w-64">
            <Mascot state="welcome" size="lg" />
          </div>
          <div aria-hidden="true" className="absolute -bottom-24 right-8 -z-0 h-64 w-64 rounded-full bg-white/45 sm:right-24" />
        </section>

        <div className="mt-14 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <nav aria-label="Design system sections" className="sticky top-8 space-y-1 border-l border-border pl-4 text-sm">
              {["Color palette", "Typography", "Buttons", "Surfaces & forms", "Semantic feedback", "Data visualization", "Components", "Accessibility"].map((item, index) => <a key={item} href={`#${["palette", "type", "buttons", "surfaces", "semantic", "visualization", "components", "accessibility"][index]}`} className="block rounded-lg px-3 py-2 text-muted transition-colors hover:bg-surface-hover hover:text-foreground">{item}</a>)}
            </nav>
          </aside>

          <div className="min-w-0 space-y-16">
            <section id="palette" className="scroll-mt-8" aria-labelledby="palette-heading">
              <SectionHeading eyebrow="01 · Color" title="A palette with room to breathe" description="The 60–30–10 balance is a visual guide: warm neutrals lead, blush supports, and Abii pink draws the eye to action. The dashboard frame swatch is structural, not an additional brand accent." id="palette-heading" />
              <div className="mt-7 grid gap-4 md:grid-cols-3">
                {colorGroups.map((group) => <article key={group.title} className="overflow-hidden rounded-2xl border border-border bg-surface">
                  <div className="flex h-24 items-end bg-background p-4"><div className="h-12 flex-1 rounded-lg bg-secondary-surface" /><div className="ml-2 h-12 w-16 rounded-lg bg-primary" /></div>
                  <div className="p-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary-hover">{group.title}</p><p className="mt-2 min-h-10 text-sm leading-5 text-muted">{group.note}</p>
                    <div className="mt-4 space-y-2">{group.colors.map(([name, hex]) => <Swatch key={`${name}-${hex}`} name={name} hex={hex} />)}</div>
                  </div>
                </article>)}
              </div>
            </section>

            <section id="type" className="scroll-mt-8" aria-labelledby="type-heading">
              <SectionHeading eyebrow="02 · Type & neutrals" title="Clear, friendly, considered" description="Onest carries the interface: confident headings, readable body copy, and restrained supporting labels." id="type-heading" />
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {typography.map(([name, hex, usage]) => <Card key={name}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-muted">{name}</p><p className="mt-4 text-2xl font-bold tracking-tight">Learn a little.</p><p className="mt-2 text-sm leading-6 text-muted">{usage}</p></div><code className="rounded-lg bg-surface-hover px-2.5 py-1.5 text-xs text-muted">{hex}</code></div></Card>)}
              </div>
            </section>

            <section id="buttons" className="scroll-mt-8" aria-labelledby="buttons-heading">
              <SectionHeading eyebrow="03 · Actions" title="One clear next step" description="Filled pink is reserved for the primary action. Supporting controls stay quiet and easy to scan." id="buttons-heading" />
              <Card className="mt-6">
                <div className="flex flex-wrap items-center gap-3"><Button>Continue</Button><Button variant="secondary">Secondary</Button><Button variant="outline">Outline</Button><Button variant="ghost">Ghost</Button><Button variant="danger">Remove</Button><Button disabled>Disabled</Button></div>
                <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-5"><Button size="sm">Small</Button><Button>Default</Button><Button size="lg">Large action</Button><p className="text-xs text-muted">Hover and press the primary button to see its interaction colors.</p></div>
              </Card>
              <p className="mt-3 text-sm leading-6 text-muted">White text on #F8769C is the approved visual treatment. It does not meet WCAG AA contrast for normal-sized text; this is a documented palette limitation.</p>
            </section>

            <section id="surfaces" className="scroll-mt-8" aria-labelledby="surfaces-heading">
              <SectionHeading eyebrow="04 · Everyday UI" title="Soft surfaces, useful structure" description="White cards sit on warm backgrounds, with fine borders doing most of the separating." id="surfaces-heading" />
              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <Card><CardHeader><CardTitle>Biology basics</CardTitle><CardDescription>Chapter 1 · 12 flashcards</CardDescription></CardHeader><ProgressBar value={8} max={12} label="Cards reviewed" /><div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4"><span className="text-sm text-muted">8 of 12 practiced</span><Button size="sm" variant="outline">Continue</Button></div></Card>
                <Card><div className="space-y-4"><TextInput label="Subject name" name="subject-name" placeholder="e.g. Biology" hint="Choose a name you’ll recognize." /><TextArea label="Flashcard question" name="question" placeholder="What do you want to remember?" /><TextInput label="Validation example" name="email-example" placeholder="name@example.com" error="Please enter a valid email address." /></div></Card>
              </div>
            </section>

            <section id="semantic" className="scroll-mt-8" aria-labelledby="semantic-heading">
              <SectionHeading eyebrow="05 · Status colors" title="Color with meaning" description="Semantic colors appear only when the interface is communicating a real status. The icon, title, and message carry meaning without relying on color alone." id="semantic-heading" />
              <div className="mt-6 grid gap-4 md:grid-cols-3">{semantic.map(({ name, hex, bg, text, icon: Icon, message }) => <article key={name} className="rounded-2xl border border-border bg-surface p-5"><div className="flex items-center gap-2"><Icon className="h-5 w-5" style={{ color: hex }} aria-hidden="true" /><h3 className="font-bold">{name}</h3></div><p className="mt-3 rounded-xl px-3 py-3 text-sm leading-5" style={{ color: text, backgroundColor: bg }}>{message}</p><div className="mt-4 flex items-center gap-2"><span className="h-5 w-5 rounded-md" style={{ backgroundColor: hex }} /><code className="text-xs text-muted">{hex} · {bg} · {text}</code></div></article>)}</div>
              <div className="mt-5 grid gap-4 md:grid-cols-2"><Card><CardTitle>Success answer</CardTitle><div className="mt-4"><Flashcard subject="BIOLOGY · IDENTIFICATION" question="What is the basic unit of life?" answer="The cell." /></div></Card><Card><CardTitle>Error message</CardTitle><div className="mt-4"><ErrorMessage title="Couldn’t save this card" message="Check your connection and try again." /></div></Card></div>
            </section>

            <section id="visualization" className="scroll-mt-8" aria-labelledby="visualization-heading">
              <SectionHeading eyebrow="06 · Data visualization" title="Pink series, clear distinctions" description="Admin charts use one pink family. Line patterns, bar fills, and labels keep datasets distinct without borrowing semantic status colors." id="visualization-heading" />
              <Card className="mt-6">
                <div className="grid gap-2 sm:grid-cols-2">{chartSwatches.map(([name, hex]) => <Swatch key={name} name={name} hex={hex} />)}</div>
                <figure className="mt-5 rounded-xl border border-border bg-white p-4">
                  <svg role="img" aria-label="Example chart with solid primary, dashed secondary, and dotted tertiary pink series" viewBox="0 0 480 150" className="h-36 w-full" preserveAspectRatio="none">
                    <path d="M0 28H480M0 75H480M0 122H480" fill="none" stroke={adminChartColors.grid} strokeWidth="1" />
                    <path d="M0 112 C55 94 74 104 120 82 S200 66 240 78 S315 44 360 54 S430 28 480 36" fill="none" stroke={adminChartColors.primary} strokeWidth="3" />
                    <path d="M0 125 C55 118 80 74 120 88 S195 110 240 68 S320 94 360 75 S420 83 480 58" fill="none" stroke={adminChartColors.secondary} strokeWidth="2.5" strokeDasharray="8 6" />
                    <path d="M0 137 C58 128 84 132 120 116 S200 124 240 108 S316 126 360 102 S425 112 480 91" fill="none" stroke={adminChartColors.tertiary} strokeWidth="2" strokeDasharray="2 6" strokeLinecap="round" />
                  </svg>
                  <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
                    <span><span aria-hidden="true" className="mr-2 inline-block w-7 border-t-[3px] align-middle" style={{ borderColor: adminChartColors.primary }} />Primary · solid</span>
                    <span><span aria-hidden="true" className="mr-2 inline-block w-7 border-t-2 border-dashed align-middle" style={{ borderColor: adminChartColors.secondary }} />Secondary · dashed</span>
                    <span><span aria-hidden="true" className="mr-2 inline-block w-7 border-t-2 border-dotted align-middle" style={{ borderColor: adminChartColors.tertiary }} />Tertiary · dotted</span>
                  </figcaption>
                </figure>
              </Card>
            </section>

            <section id="components" className="scroll-mt-8" aria-labelledby="components-heading">
              <SectionHeading eyebrow="07 · Component library" title="The system in real components" description="Examples below use shared, working Abii components. Try the flashcard, toast controls, and modal triggers." id="components-heading" />
              <div className="mt-6 grid gap-5 md:grid-cols-2"><Card><CardTitle>Flashcard · prompt</CardTitle><div className="mt-4"><Flashcard subject="BIOLOGY · IDENTIFICATION" question="What is the basic unit of life?" hint="Think of the smallest building block of living things." /></div></Card><Card><CardTitle>Flashcard · answer</CardTitle><div className="mt-4"><Flashcard subject="BIOLOGY · IDENTIFICATION" question="What is the basic unit of life?" answer="The cell." footer={<Button size="sm">Correct</Button>} /></div></Card></div>
              <div className="mt-5 grid gap-5 md:grid-cols-2"><Card><CardTitle>Loading state</CardTitle><div className="mt-4"><LoadingState message="Loading your study cards…" /></div></Card><Card><CardTitle>Empty state</CardTitle><div className="mt-4"><EmptyState title="No flashcards yet" message="Create your first card to start practicing active recall." action={<Button>Create a flashcard</Button>} /></div></Card></div>
              <Card className="mt-5"><CardTitle>Mascot moods</CardTitle><p className="mt-1 text-sm text-muted">Original mascot artwork stays consistent across the experience.</p><div className="mt-5 grid grid-cols-3 gap-4 sm:grid-cols-6">{(["welcome", "correct", "wrong", "review-reminder", "complete", "empty"] as MascotState[]).map((state) => <div key={state} className="flex min-w-0 flex-col items-center gap-2 rounded-xl bg-surface-hover p-3 text-center"><Mascot state={state} size="sm" /><span className="text-xs font-medium text-muted">{state.replace("-", " ")}</span></div>)}</div></Card>
              <ToastShowcase />
              <ModalShowcase />
            </section>

            <section id="accessibility" className="scroll-mt-8" aria-labelledby="accessibility-heading">
              <SectionHeading eyebrow="08 · Accessibility" title="A clear interface for more learners" description="Color supports meaning; it never has to carry it alone." id="accessibility-heading" />
              <div className="mt-6 rounded-2xl border border-border bg-surface p-5 sm:p-7"><ul className="space-y-3 text-sm leading-6 text-muted">{["Keep keyboard focus visible on buttons, links, fields, and dialogs.", "Pair status colors with labels, icons, and helpful text.", "Respect reduced-motion preferences for decorative movement.", "Use the selected palette as approved; white on the primary pink is a known contrast exception for normal text."].map((item) => <li key={item} className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" /><span>{item}</span></li>)}</ul></div>
            </section>
          </div>
        </div>
        <footer className="mt-16 border-t border-border pt-6 text-sm text-muted">Abii · Learn a little, remember a lot.</footer>
      </div>
    </main>
  );
}

function SectionHeading({ eyebrow, title, description, id }: { eyebrow: string; title: string; description: string; id: string }) {
  return <header><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-hover">{eyebrow}</p><h2 id={id} className="mt-2 text-2xl font-bold tracking-[-0.03em] sm:text-3xl">{title}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">{description}</p></header>;
}

function Swatch({ name, hex }: { name: string; hex: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"><div className="flex min-w-0 items-center gap-2.5"><span className="h-6 w-6 shrink-0 rounded-md border border-black/5" style={{ backgroundColor: hex }} /><span className="truncate text-xs font-medium text-foreground">{name}</span></div><code className="shrink-0 text-[11px] text-muted">{hex}</code></div>;
}
