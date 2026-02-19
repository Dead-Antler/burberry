import { LoginForm } from '@/app/components/login-form';
import { isSignupEnabled } from '@/app/lib/settings-utils';

export default async function LoginPage() {
  const signupEnabled = await isSignupEnabled();

  return (
    <div id="main-content" className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm signupEnabled={signupEnabled} />
      </div>
    </div>
  );
}
