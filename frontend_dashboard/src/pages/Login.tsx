import { useState, type CSSProperties } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login } from '@/lib/api/client';
import { ApiError } from '@/lib/api/http';
import { useAuthStore } from '@/lib/store/auth';

function errorDetail(err: unknown): string {
  if (err instanceof ApiError) {
    try {
      const parsed = JSON.parse(err.message) as { detail?: string; };
      if (parsed.detail) return parsed.detail;
    } catch {
      // Body was not JSON — fall through to the generic message.
    }
    if (err.status === 401) return 'Invalid email or password';
  }
  return 'Sign in failed. Please try again.';
}

export default function Login() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (token) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await login(email, password);
      setAuth(res.token, res.user);
      navigate('/');
    } catch (err) {
      setError(errorDetail(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="flex min-h-screen bg-background"
      style={
        {
          // Keep login on the original navy/blue palette
          '--ring': '#2c64f1',
          '--hg-secondary': '#2c64f1',
          '--hg-accent': '#2c64f1',
        } as CSSProperties
      }
    >      {/* Brand panel — HateGuard navy (#19305a) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 flex-col justify-between bg-gradient-to-br from-[#24468a] via-[#19305a] to-[#0e1c38] p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-white/10 ring-1 ring-white/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <span className="text-2xl font-semibold tracking-tight">HateGuard</span>
        </div>

        <div className="space-y-6 max-w-lg">
          <p className="text-sm font-medium uppercase tracking-widest text-white/60">
            Hate detection as a service
          </p>
          <h1 className="text-5xl xl:text-6xl font-bold leading-[1.05] tracking-tight">
            Safer platforms, in every language.
          </h1>
          <p className="text-lg text-white/75 leading-relaxed">
            Classify, triage, and explain hate speech in Igbo and Yoruba, through one API.
            Every call you make is tracked to your account and language.
          </p>
        </div>

        <p className="text-sm text-white/50">© 2026 HateGuard</p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 lg:hidden mb-6">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <span className="text-xl font-semibold">HateGuard</span>
            </div>
            <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
              Sign in
            </p>
            <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground">
              Sign in with the account your administrator created for you.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="h-11"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="h-11 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full h-11 text-base" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Sign in
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center">
            Need an account or API key? Contact your HateGuard administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
