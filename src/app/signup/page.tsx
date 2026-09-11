import Link from "next/link";
import { AuthForm } from "../../components/auth-form";
import { SealMark } from "../../components/postmark";

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2 text-ink">
        <SealMark char="回" />
        <span className="font-display text-lg font-bold">明日回声</span>
      </Link>
      <AuthForm mode="signup" />
    </main>
  );
}
