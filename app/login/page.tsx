import { AuthForm } from "@/components/auth/auth-form";
import { AuthLayout } from "@/components/auth/auth-layout";

export default function LoginPage() {
  return <AuthLayout mode="login"><AuthForm mode="login" /></AuthLayout>;
}
