/** Themed header strip for Settings cards and sections (uses active palette soft secondary). */
export const settingsSectionHeaderClass =
  'w-full border-b border-[var(--hg-border)] bg-[var(--hg-soft)] px-6 py-6';

/** Form strip under a settings section header (inputs + primary action). */
export const settingsFormStripClass =
  'border-b border-[var(--hg-border)] bg-white px-6 py-8';

/** Shared layout tokens for Settings inline forms (aligned labels + controls). */
export const settingsFormRowClass =
  'flex flex-col gap-4 md:flex-row md:items-end md:gap-3';

export const settingsFormFieldClass = 'flex min-w-0 flex-1 flex-col gap-2';

export const settingsFormControlClass =
  'h-9 w-full border-[var(--hg-border)] data-[size=default]:h-9 data-[size=sm]:h-9';

export const settingsFormActionClass =
  'h-9 w-full shrink-0 cursor-pointer gap-1.5 px-4 md:w-auto';
