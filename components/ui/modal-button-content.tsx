import { LoaderCircle } from "lucide-react";

type ModalButtonContentProps = {
  loading: boolean;
  label: string;
  loadingLabel: string;
};

/** Keeps modal action labels and their optional spinner centered as one unit. */
export function ModalButtonContent({ loading, label, loadingLabel }: ModalButtonContentProps) {
  return (
    <span
      className="inline-flex min-w-0 items-center justify-center gap-2 whitespace-normal text-center"
      role={loading ? "status" : undefined}
      aria-busy={loading || undefined}
    >
      {loading && <LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" />}
      <span className="min-w-0 break-words leading-tight">{loading ? loadingLabel : label}</span>
    </span>
  );
}
