export const REVIEW_STATUSES = [
  'PENDING_REVIEW',
  'DRAFT',
  'REVIEWED_NO_ALERT',
  'REVIEWED_FOR_ALERT',
] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  PENDING_REVIEW: 'Pending review',
  DRAFT: 'Draft',
  REVIEWED_NO_ALERT: 'Reviewed — no alert',
  REVIEWED_FOR_ALERT: 'Reviewed — prepare alert',
};

export const REVIEW_STATUS_STYLES: Record<ReviewStatus, string> = {
  PENDING_REVIEW: 'border-amber-300 bg-amber-50 text-amber-800',
  DRAFT: 'border-blue-200 bg-blue-50 text-blue-700',
  REVIEWED_NO_ALERT: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  REVIEWED_FOR_ALERT: 'border-primary/20 bg-accent text-primary',
};

export const REVIEW_TEMPLATES = [
  {
    label: 'Generally consistent with observations',
    text: 'The forecast probability estimates are generally consistent with the possibly related earthquakes observed so far. Continued monitoring is recommended.',
  },
  {
    label: 'Use with additional caution',
    text: 'The available observations do not fully align with the forecast probability estimates. Interpret the forecast with additional caution and continue monitoring new catalog updates.',
  },
  {
    label: 'Insufficient observations',
    text: 'There are not yet enough possibly related observed earthquakes to assess this forecast. Review again when additional catalog observations are available.',
  },
] as const;

export type ReviewInput = {
  status: ReviewStatus;
  reviewText: string;
  internalNote: string;
};

function textField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export function parseReviewInput(formData: FormData): ReviewInput {
  const rawStatus = textField(formData, 'status');
  if (!REVIEW_STATUSES.includes(rawStatus as ReviewStatus)) {
    throw new Error('Select a valid review status.');
  }

  const status = rawStatus as ReviewStatus;
  const reviewText = textField(formData, 'review_text');
  const internalNote = textField(formData, 'internal_note');
  if (reviewText.length > 5000 || internalNote.length > 5000) {
    throw new Error('Review text and internal notes must each be 5,000 characters or fewer.');
  }
  if (status.startsWith('REVIEWED_') && !reviewText) {
    throw new Error('Completed reviews require review text.');
  }

  return { status, reviewText, internalNote };
}
