/** Shared layout for one-time secret reveal dialogs (API keys, invite passwords). */
export const settingsRevealDialogContentClass =
  'gap-0 overflow-hidden border border-primary/25 p-0 ring-1 ring-primary/15 sm:max-w-lg';

export const settingsRevealDialogAlertClass =
  'border-b border-primary/20 bg-amber-50 px-6 py-5 dark:border-primary/30 dark:bg-amber-950/40';

export const settingsRevealDialogBodyClass = 'space-y-4 px-6 py-5';

export const settingsRevealDialogSecretPanelClass =
  'space-y-4 rounded-lg border border-primary/30 bg-[var(--hg-shell)] p-4 text-sm';

export const settingsRevealDialogSecretValueClass =
  'rounded-md border border-primary/25 bg-white px-3 py-2.5 dark:bg-background';

export const settingsRevealDialogSecretDividerClass = 'h-px bg-primary/20';

export const settingsRevealDialogFooterClass =
  'mx-0 mb-0 flex flex-row justify-end border-t border-primary/20 bg-[var(--hg-shell)]/50 px-6 pt-4 pb-6';

/** Matches Settings form primary actions (`settingsFormActionClass`). */
export const settingsRevealDialogButtonClass =
  'h-9 shrink-0 cursor-pointer gap-1.5 px-4';

export const settingsRevealDialogOutlineButtonClass =
  `${settingsRevealDialogButtonClass} border-primary/35 text-primary hover:bg-primary/5 hover:text-primary`;
