import { Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionTitle } from '@/components/ui/data-source-badge';
import { ApiKeyManager } from '@/components/settings/ApiKeyManager';
import { InviteUserManager } from '@/components/settings/InviteUserManager';
import { OrganizationManager } from '@/components/settings/OrganizationManager';
import { COLOR_THEMES } from '@/lib/theme/catalog';
import { useThemeStore } from '@/lib/store/theme';
import { useAuthStore } from '@/lib/store/auth';
import { USE_MOCK } from '@/lib/api/config';
import { settingsSectionHeaderClass } from '@/components/settings/settings-form-layout';
import { OpenAiModerationNotice } from '@/components/testing/OpenAiModerationNotice';
import { cn } from '@/lib/utils';

export default function Settings() {
  const themeId = useThemeStore((s) => s.themeId);
  const setThemeId = useThemeStore((s) => s.setThemeId);
  const user = useAuthStore((s) => s.user);
  const canInvite =
    user?.can_invite_users ??
    user?.can_manage_api_keys ??
    user?.is_platform_admin ??
    false;
  const isPlatformAdmin = user?.is_platform_admin ?? false;

  return (
    <div className="space-y-8">
      <SectionTitle description="Dashboard preferences, team access, and organization API keys.">
        Settings
      </SectionTitle>

      {!USE_MOCK && <OpenAiModerationNotice />}

      {user && (
        <Card className="gap-0 p-0">
          <CardHeader className={cn(settingsSectionHeaderClass, 'rounded-none')}>
            <CardTitle className="text-base font-semibold text-[var(--hg-ink)]">Account</CardTitle>
            <CardDescription className="text-[var(--hg-muted)] space-y-1">
              {user.name ? (
                <span className="block text-sm font-medium text-[var(--hg-ink)]">{user.name}</span>
              ) : null}
              <span className="block">{user.email}</span>
              {user.org_name ? (
                <span className="block text-xs">Organization: {user.org_name}</span>
              ) : null}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {!USE_MOCK && isPlatformAdmin && <OrganizationManager />}

      {!USE_MOCK && canInvite && <InviteUserManager />}

      {!USE_MOCK &&
        (user?.can_manage_api_keys || isPlatformAdmin) && <ApiKeyManager />}

      <Card className="gap-0 pt-0">
        <CardHeader className={cn(settingsSectionHeaderClass, 'rounded-none')}>
          <CardTitle className="text-base font-semibold text-[var(--hg-ink)]">
            Color theme
          </CardTitle>
          <CardDescription className="text-[var(--hg-muted)]">
            Choose a palette. Your choice is saved for your account on this browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          {COLOR_THEMES.map((theme) => {
            const selected = themeId === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => setThemeId(theme.id)}
                className={cn(
                  'flex flex-col rounded-[4px] border p-4 text-left transition-colors',
                  selected
                    ? 'border-[var(--hg-brand)] ring-2 ring-[var(--hg-brand)]/25'
                    : 'border-[var(--hg-border)] hover:border-[var(--hg-muted)]',
                )}
              >
                <div className="mb-3 flex gap-1.5">
                  <span
                    className="h-8 flex-1 rounded-sm border border-black/5"
                    style={{ background: theme.preview.shell }}
                    title="Page background"
                  />
                  <span
                    className="h-8 w-10 rounded-sm border border-black/5"
                    style={{ background: theme.preview.soft }}
                    title="Selected nav"
                  />
                  <span
                    className="h-8 w-10 rounded-sm border border-black/5"
                    style={{ background: theme.preview.accent }}
                    title="Accent tile"
                  />
                  <span
                    className="h-8 w-10 rounded-sm border border-black/5"
                    style={{ background: theme.preview.primary }}
                    title="Primary button"
                  />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--hg-ink)]">{theme.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--hg-muted)]">
                      {theme.description}
                    </p>
                  </div>
                  {selected && (
                    <span
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--hg-brand)] text-white"
                      aria-hidden
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
