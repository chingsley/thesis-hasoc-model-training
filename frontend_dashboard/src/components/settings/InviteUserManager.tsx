import { useCallback, useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, Check, Copy, Loader2, Plus, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createUserInvite,
  fetchOrganizations,
  fetchUserInvites,
  revokeUserInvite,
} from '@/lib/api/client';
import { ApiError } from '@/lib/api/http';
import type { InviteInfo, OrganizationInfo } from '@/lib/types';
import { useAuthStore } from '@/lib/store/auth';
import {
  settingsFormActionClass,
  settingsFormControlClass,
  settingsFormFieldClass,
  settingsFormRowClass,
  settingsSectionHeaderClass,
} from '@/components/settings/settings-form-layout';

function formatCreated(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d, yyyy');
  } catch {
    return iso.slice(0, 10);
  }
}

function parseApiError(err: unknown): string {
  if (err instanceof ApiError) {
    try {
      const parsed = JSON.parse(err.message) as { detail?: string };
      if (typeof parsed.detail === 'string') return parsed.detail;
    } catch {
      /* plain text body */
    }
    return err.message || 'Request failed';
  }
  return 'Something went wrong';
}

export function InviteUserManager() {
  const user = useAuthStore((s) => s.user);
  const orgName = user?.org_name ?? 'your organization';
  const activeOrgId = user?.organization_id;
  const isPlatformAdmin = user?.is_platform_admin ?? false;
  const [organizations, setOrganizations] = useState<OrganizationInfo[]>([]);
  const [inviteOrgId, setInviteOrgId] = useState<number | null>(null);
  const [invites, setInvites] = useState<InviteInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealEmail, setRevealEmail] = useState('');
  const [revealPassword, setRevealPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadInvites = useCallback(async () => {
    setLoading(true);
    try {
      setInvites(await fetchUserInvites());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvites();
  }, [loadInvites, activeOrgId]);

  useEffect(() => {
    if (!isPlatformAdmin) return;
    fetchOrganizations()
      .then((rows) => {
        setOrganizations(rows);
        setInviteOrgId((prev) => prev ?? activeOrgId ?? rows[0]?.id ?? null);
      })
      .catch(() => {});
  }, [isPlatformAdmin, activeOrgId]);

  useEffect(() => {
    if (isPlatformAdmin && activeOrgId != null) {
      setInviteOrgId(activeOrgId);
    }
  }, [isPlatformAdmin, activeOrgId]);

  const handleInvite = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setFormError('Enter an email address');
      return;
    }
    setBusy(true);
    setFormError(null);
    setCopied(false);
    try {
      const targetOrg =
        isPlatformAdmin && inviteOrgId != null ? inviteOrgId : undefined;
      const res = await createUserInvite(trimmed, targetOrg);
      setRevealEmail(res.invite.email);
      setRevealPassword(res.temporary_password);
      setRevealOpen(true);
      setEmail('');
      await loadInvites();
    } catch (err) {
      setFormError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCopyCredentials = async () => {
    if (!revealPassword) return;
    const text = `Login email: ${revealEmail}\nTemporary password: ${revealPassword}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const closeReveal = () => {
    setRevealOpen(false);
    setRevealPassword(null);
    setRevealEmail('');
    setCopied(false);
  };

  const handleRevoke = async (id: number) => {
    setBusy(true);
    try {
      await revokeUserInvite(id);
      await loadInvites();
    } finally {
      setBusy(false);
    }
  };

  const orgItems = organizations.map((org) => ({
    value: String(org.id),
    label: org.name,
  }));

  return (
    <section
      className="overflow-hidden rounded-xl border border-[var(--hg-border)] bg-white shadow-[var(--hg-shadow)]"
      aria-labelledby="invite-user-manager-title"
    >
      <div className={settingsSectionHeaderClass}>
        <h2
          id="invite-user-manager-title"
          className="font-heading text-base font-semibold text-[var(--hg-ink)]"
        >
          Team invites
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm text-[var(--hg-muted)]">
          {isPlatformAdmin ? (
            <>
              Invite users by email. Pending invites below are for the{' '}
              <span className="font-medium text-[var(--hg-ink)]">active organization</span> (
              {orgName}). Pick another organization when sending a new invite.
            </>
          ) : (
            <>
              Add people to <span className="font-medium text-[var(--hg-ink)]">{orgName}</span> by
              email. A random temporary password is generated once — share it securely.
            </>
          )}
        </p>
      </div>

      <div className="border-b border-[var(--hg-border)] bg-white px-6 py-5">
        <div className={settingsFormRowClass}>
          {isPlatformAdmin && organizations.length > 0 ? (
            <div className={settingsFormFieldClass}>
              <Label htmlFor="invite-org">Organization</Label>
              <Select
                value={inviteOrgId != null ? String(inviteOrgId) : undefined}
                onValueChange={(v) => setInviteOrgId(Number(v))}
                items={orgItems}
              >
                <SelectTrigger id="invite-org" className={settingsFormControlClass}>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={String(org.id)}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className={settingsFormFieldClass}>
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="off"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={settingsFormControlClass}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleInvite();
              }}
            />
          </div>
          <Button
            type="button"
            className={settingsFormActionClass}
            onClick={handleInvite}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Generate invite
          </Button>
        </div>
        {formError ? (
          <p className="mt-3 text-sm text-destructive" role="alert">{formError}</p>
        ) : null}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin text-[var(--hg-subtle)]" />
        </div>
      ) : invites.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-[var(--hg-muted)]">
          No pending invites for {orgName}.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 pl-6 normal-case tracking-normal text-xs font-medium" />
                <TableHead className="min-w-[200px] normal-case tracking-normal text-xs font-medium">
                  Email
                </TableHead>
                <TableHead className="normal-case tracking-normal text-xs font-medium">
                  Invited
                </TableHead>
                <TableHead className="normal-case tracking-normal text-xs font-medium">
                  Status
                </TableHead>
                <TableHead className="w-[80px] pr-6 text-right normal-case tracking-normal text-xs font-medium">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((inv) => (
                <TableRow key={inv.id} className="hover:bg-[var(--hg-shell)]/40">
                  <TableCell className="pl-6">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--hg-border)] bg-[var(--hg-shell)] text-[var(--hg-muted)]"
                      aria-hidden
                    >
                      <UserPlus className="h-4 w-4" />
                    </span>
                  </TableCell>
                  <TableCell className="font-medium text-[var(--hg-ink)]">{inv.email}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-[var(--hg-muted)]">
                    {formatCreated(inv.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-[var(--hg-muted)]">Pending signup</TableCell>
                  <TableCell className="pr-6 text-right">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleRevoke(inv.id)}
                      className="cursor-pointer text-sm font-medium text-destructive transition-colors hover:text-destructive/80 disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={revealOpen} onOpenChange={(open) => !open && closeReveal()}>
        <DialogContent
          className="gap-0 overflow-hidden p-0 sm:max-w-md"
          showCloseButton={false}
        >
          <div className="border-b border-amber-200/80 bg-amber-50 px-5 py-4 dark:border-amber-900/50 dark:bg-amber-950/40">
            <DialogHeader className="gap-2 text-left">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <DialogTitle className="text-base">Share login credentials</DialogTitle>
              </div>
              <DialogDescription className="text-amber-900/80 dark:text-amber-100/80">
                This temporary password is shown only once. Send it to the invitee along with your
                dashboard login URL.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-4 p-5">
            <div className="space-y-3 rounded-lg border border-[var(--hg-border)] bg-[var(--hg-shell)] p-3 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--hg-muted)]">
                  Email
                </p>
                <p className="mt-0.5 font-medium text-[var(--hg-ink)]">{revealEmail}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--hg-muted)]">
                  Temporary password
                </p>
                <code className="mt-0.5 block break-all font-mono text-xs leading-relaxed text-[var(--hg-ink)]">
                  {revealPassword}
                </code>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full cursor-pointer gap-2"
              onClick={handleCopyCredentials}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy email and password
                </>
              )}
            </Button>
          </div>
          <DialogFooter className="border-t border-[var(--hg-border)] bg-[var(--hg-shell)]/50 px-5 py-4">
            <Button type="button" className="w-full cursor-pointer sm:w-auto" onClick={closeReveal}>
              I&apos;ve shared these credentials
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
