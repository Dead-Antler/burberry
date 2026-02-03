import { redirect } from 'next/navigation';
import { SignupForm } from '@/app/components/signup-form';
import { isSignupEnabled } from '@/app/lib/settings-utils';

export default async function SignupPage() {
  const signupEnabled = await isSignupEnabled();

  // Redirect to login if signup is disabled
  if (!signupEnabled) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <SignupForm />
      </div>
    </div>
  );
}
