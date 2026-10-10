import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { MascotDisplay } from "@/components/ui/mascot-display";

export default function RegisterPage() {
  return <main className="flex min-h-screen items-center justify-center bg-pink-soft px-4 py-10">
    <section className="w-full max-w-md rounded-3xl border border-border bg-white p-6 shadow-sm sm:p-8">
      <Link href="/" className="text-sm font-semibold text-pink-active">← Back to Abii</Link>
      <div className="my-4 flex justify-center"><MascotDisplay mood="welcome" compact /></div>
      <h1 className="text-center text-2xl font-bold">Create your Abii account</h1>
      <p className="mb-6 mt-2 text-center text-sm text-muted">A little practice goes a long way.</p>
      <AuthForm mode="register" />
    </section>
  </main>;
}
