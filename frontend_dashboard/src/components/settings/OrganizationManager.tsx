import { useCallback, useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Building2, Loader2, Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
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
  createOrganization,
  fetchOrganizations,
  setActiveOrganization,
} from '@/lib/api/client';
import { ApiError } from '@/lib/api/http';
import { useAuthStore } from '@/lib/store/auth';
import type { OrganizationInfo } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  settingsFormActionClass,
  settingsFormControlClass,
  settingsFormFieldClass,
  settingsFormRowClass,
  settingsFormStripClass,
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
      const parsed = JSON.parse(err.message) as { detail?: string; };
      if (typeof parsed.detail === 'string') return parsed.detail;
    } catch {
      /* plain text */
    }
    return err.message || 'Request failed';
  }
  return 'Something went wrong';
}

export function OrganizationManager() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const queryClient = useQueryClient();
  const [orgs, setOrgs] = useState<OrganizationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const loadOrgs = useCallback(async () => {
    setLoading(true);
    try {
      setOrgs(await fetchOrganizations());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError('Enter an organization name');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await createOrganization(trimmed);
      setName('');
      await loadOrgs();
    } catch (err) {
      setFormError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSwitch = async (orgId: number) => {
    if (!token || orgId === user?.organization_id) return;
    setBusy(true);
    try {
      const updated = await setActiveOrganization(orgId);
      setAuth(token, updated);
      await queryClient.invalidateQueries();
    } finally {
      setBusy(false);
    }
  };

  const activeId = user?.organization_id;

  return (
    <section
      className="overflow-hidden rounded-xl border border-[var(--hg-border)] bg-white shadow-[var(--hg-shadow)]"
      aria-labelledby="organization-manager-title"
    >
      <div className={settingsSectionHeaderClass}>
        <h2
          id="organization-manager-title"
          className="font-heading text-base font-semibold text-[var(--hg-ink)]"
        >
          Organizations
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm text-[var(--hg-muted)]">
          Create tenant organizations and switch which one you are managing. Dashboard data,
          invites, and API keys apply to the{' '}
          <span className="font-medium text-[var(--hg-ink)]">active organization</span>.
        </p>
      </div>

      <div className={settingsFormStripClass}>
        <div className={settingsFormRowClass}>
          <div className={settingsFormFieldClass}>
            <Label htmlFor="org-name">New organization</Label>
            <Input
              id="org-name"
              placeholder="e.g. Partner Media Ltd"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={settingsFormControlClass}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
              }}
            />
          </div>
          <Button
            type="button"
            className={settingsFormActionClass}
            onClick={handleCreate}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create organization
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
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 pl-6 normal-case tracking-normal text-xs font-medium" />
                <TableHead className="normal-case tracking-normal text-xs font-medium">Name</TableHead>
                <TableHead className="normal-case tracking-normal text-xs font-medium">Created</TableHead>
                <TableHead className="w-[100px] pr-6 text-right normal-case tracking-normal text-xs font-medium">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((org) => {
                const active = org.id === activeId;
                return (
                  <TableRow
                    key={org.id}
                    className={cn('hover:bg-[var(--hg-shell)]/40', active && 'bg-[var(--hg-shell)]/30')}
                  >
                    <TableCell className="pl-6">
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--hg-border)] bg-[var(--hg-shell)] text-[var(--hg-muted)]"
                        aria-hidden
                      >
                        <Building2 className="h-4 w-4" />
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-[var(--hg-ink)]">
                      {org.name}
                      {active ? (
                        <span className="ml-2 text-xs font-normal text-[var(--hg-brand)]">
                          Active
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-[var(--hg-muted)]">
                      {formatCreated(org.created_at)}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      {active ? (
                        <span className="text-sm text-[var(--hg-muted)]">Viewing</span>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleSwitch(org.id)}
                          className="cursor-pointer text-sm font-medium text-[var(--hg-brand)] hover:underline disabled:opacity-50"
                        >
                          Switch
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
