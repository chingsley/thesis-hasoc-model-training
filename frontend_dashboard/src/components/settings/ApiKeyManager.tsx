import { useCallback, useEffect, useState } from 'react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { AlertTriangle, Check, Copy, KeyRound, Loader2, Plus } from 'lucide-react';
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
import { createApiKey, fetchApiKeys, fetchOrganizations, revokeApiKey } from '@/lib/api/client';
import { ApiError } from '@/lib/api/http';
import type { ApiKeyInfo, OrganizationInfo } from '@/lib/types';
import { useAuthStore } from '@/lib/store/auth';
import { cn } from '@/lib/utils';
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

function formatLastUsed(iso: string | null): string {
  if (!iso) return 'Never';
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return '—';
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

function maskedSecret(prefix: string): string {
  if (!prefix) return '••••••••••••••••';
  const tail = prefix.length >= 4 ? prefix.slice(-4) : prefix;
  const head = prefix.includes('_')
    ? prefix.slice(0, prefix.indexOf('_') + 1)
    : prefix.slice(0, Math.min(4, prefix.length));
  const dots = Math.max(8, 20 - head.length - tail.length);
  return `${head}${'•'.repeat(dots)}${tail}`;
}

export function ApiKeyManager() {
  const user = useAuthStore((s) => s.user);
  const orgName = user?.org_name ?? 'your organization';
  const activeOrgId = user?.organization_id;
  const isPlatformAdmin = user?.is_platform_admin ?? false;
  const [organizations, setOrganizations] = useState<OrganizationInfo[]>([]);
  const [keyOrgId, setKeyOrgId] = useState<number | null>(null);
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [newKeyPlaintext, setNewKeyPlaintext] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      setKeys(await fetchApiKeys());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys, activeOrgId]);

  useEffect(() => {
    if (!isPlatformAdmin) return;
    fetchOrganizations()
      .then((rows) => {
        setOrganizations(rows);
        setKeyOrgId((prev) => prev ?? activeOrgId ?? rows[0]?.id ?? null);
      })
      .catch(() => {});
  }, [isPlatformAdmin, activeOrgId]);

  useEffect(() => {
    if (isPlatformAdmin && activeOrgId != null) {
      setKeyOrgId(activeOrgId);
    }
  }, [isPlatformAdmin, activeOrgId]);

  const orgItems = organizations.map((org) => ({
    value: String(org.id),
    label: org.name,
  }));

  const handleGenerate = async () => {
    const trimmed = label.trim();
    if (!trimmed) {
      setFormError('Enter a key name');
      return;
    }
    setBusy(true);
    setFormError(null);
    setCopied(false);
    try {
      const targetOrg =
        isPlatformAdmin && keyOrgId != null ? keyOrgId : undefined;
      const res = await createApiKey(trimmed, targetOrg);
      setNewKeyPlaintext(res.api_key);
      setRevealOpen(true);
      setLabel('');
      await loadKeys();
    } catch (err) {
      setFormError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCopyReveal = async () => {
    if (!newKeyPlaintext) return;
    await navigator.clipboard.writeText(newKeyPlaintext);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const closeReveal = () => {
    setRevealOpen(false);
    setNewKeyPlaintext(null);
    setCopied(false);
  };

  const handleRevoke = async (id: number) => {
    setBusy(true);
    try {
      await revokeApiKey(id);
      await loadKeys();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="overflow-hidden rounded-xl border border-[var(--hg-border)] bg-white shadow-[var(--hg-shadow)]"
      aria-labelledby="api-key-manager-title"
    >
      <div className={settingsSectionHeaderClass}>
        <h2
          id="api-key-manager-title"
          className="font-heading text-base font-semibold text-[var(--hg-ink)]"
        >
          API keys
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm text-[var(--hg-muted)]">
          {isPlatformAdmin ? (
            <>
              Issue keys for server-side clients. Keys listed below are for the{' '}
              <span className="font-medium text-[var(--hg-ink)]">active organization</span> (
              {orgName}). Choose the target organization when creating a new key.
            </>
          ) : (
            <>
              Issue keys for server-side clients. Send{' '}
              <code className="rounded bg-[var(--hg-shell)] px-1 py-0.5 font-mono text-xs">
                X-API-Key
              </code>{' '}
              on each request. The full secret is only shown once when you create a key.
            </>
          )}
        </p>
      </div>

      <div className="border-b border-[var(--hg-border)] bg-white px-6 py-5">
        <div className={settingsFormRowClass}>
          {isPlatformAdmin && organizations.length > 0 ? (
            <div className={settingsFormFieldClass}>
              <Label htmlFor="api-key-org">Organization</Label>
              <Select
                value={keyOrgId != null ? String(keyOrgId) : undefined}
                onValueChange={(v) => setKeyOrgId(Number(v))}
                items={orgItems}
              >
                <SelectTrigger id="api-key-org" className={settingsFormControlClass}>
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
            <Label htmlFor="api-key-label">Key name</Label>
            <Input
              id="api-key-label"
              placeholder="e.g. production-ingest"
              value={label}
              required
              aria-required="true"
              onChange={(e) => {
                setLabel(e.target.value);
                if (formError) setFormError(null);
              }}
              className={settingsFormControlClass}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleGenerate();
              }}
            />
          </div>
          <Button
            type="button"
            className={settingsFormActionClass}
            onClick={handleGenerate}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create key
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
      ) : keys.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-[var(--hg-muted)]">
          No API keys yet. Create one above to connect ingestion or the predict API.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 pl-6 normal-case tracking-normal text-xs font-medium" />
                <TableHead className="min-w-[120px] normal-case tracking-normal text-xs font-medium">
                  Name
                </TableHead>
                <TableHead className="min-w-[200px] normal-case tracking-normal text-xs font-medium">
                  Key
                </TableHead>
                <TableHead className="normal-case tracking-normal text-xs font-medium">
                  Created
                </TableHead>
                <TableHead className="normal-case tracking-normal text-xs font-medium">
                  Last used
                </TableHead>
                <TableHead className="w-[80px] pr-6 text-right normal-case tracking-normal text-xs font-medium">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => {
                const revoked = Boolean(k.revoked_at);
                return (
                  <TableRow
                    key={k.id}
                    className={cn(
                      'hover:bg-[var(--hg-shell)]/40',
                      revoked && 'opacity-55',
                    )}
                  >
                    <TableCell className="pl-6">
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--hg-border)] bg-[var(--hg-shell)] text-[var(--hg-muted)]"
                        aria-hidden
                      >
                        <KeyRound className="h-4 w-4" />
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-[var(--hg-ink)]">
                      <span className="block truncate max-w-[140px] sm:max-w-none">
                        {k.name || '—'}
                      </span>
                      {revoked && (
                        <span className="mt-0.5 block text-xs font-normal text-destructive">
                          Revoked
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="font-mono text-sm text-[var(--hg-muted)]">
                        {maskedSecret(k.prefix)}
                      </code>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-[var(--hg-muted)]">
                      {formatCreated(k.created_at)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-[var(--hg-muted)]">
                      {formatLastUsed(k.last_used_at)}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      {!revoked ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleRevoke(k.id)}
                          className="cursor-pointer text-sm font-medium text-destructive transition-colors hover:text-destructive/80 disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      ) : (
                        <span className="text-sm text-[var(--hg-subtle)]">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
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
                <DialogTitle className="text-base">Save your API key</DialogTitle>
              </div>
              <DialogDescription className="text-amber-900/80 dark:text-amber-100/80">
                This is the only time the full secret is shown. Copy it now — you cannot view it
                again.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-4 p-5">
            <div className="rounded-lg border border-[var(--hg-border)] bg-[var(--hg-shell)] p-3">
              <code className="block break-all font-mono text-xs leading-relaxed text-[var(--hg-ink)]">
                {newKeyPlaintext}
              </code>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full cursor-pointer gap-2"
              onClick={handleCopyReveal}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy to clipboard
                </>
              )}
            </Button>
          </div>
          <DialogFooter className="border-t border-[var(--hg-border)] bg-[var(--hg-shell)]/50 px-5 py-4">
            <Button type="button" className="w-full cursor-pointer sm:w-auto" onClick={closeReveal}>
              I&apos;ve saved this key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
