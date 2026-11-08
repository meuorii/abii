import { notFound } from "next/navigation";
import { LandingConcept } from "@/components/landing-concept/landing-concept";

/** Development-only homepage concept. This guard is intentionally server-side. */
export default function LandingConceptPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <LandingConcept />;
}
