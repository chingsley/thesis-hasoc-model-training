import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changePassword } from '@/lib/api/client';
import { ApiError } from '@/lib/api/http';
import { useAuthStore } from '@/lib/store/auth';
import { HateGuardLogomark } from '@/components/brand/HateGuardLogomark';

function errorDetail(err: unknown): string {
  if (err instanceof ApiError) {
    try {
      const parsed = JSON.parse(err.message) as { detail?: string };
      if (parsed.detail) return parsed.detail;
    } catch {
      /* not JSON */
    }
  }
  return 'Could not update password. Check your current password and try again.';
}

export default function ChangePassword() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (user && !user.must_change_password) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      setError('New password and confirmation do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const updated = await changePassword(current, next);
      if (token) setAuth(token, updated);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorDetail(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2">
            <div className="mb-6 flex items-center gap-2">
              <HateGuardLogomark size={28} className="h-7 w-7 text-primary" />
              <span className="text-xl font-semibold">HateGuard</span>
            </div>
            <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
              Account security
            </p>
            <h2 className="text-3xl font-bold tracking-tight">Set a new password</h2>
            <p className="text-muted-foreground">
              Your administrator invited you with a temporary password. Choose a new password
              before you can use the dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="current">Current (temporary) password</Label>
              <Input
                id="current"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                required
                className="h-11"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">New password</Label>
              <div className="relative">
                <Input
                  id="new"
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="h-11 pr-10"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Hide passwords' : 'Show passwords'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                required
                className="h-11"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="h-11 w-full text-base" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save and continue
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
