/** Shared product boundaries used by worker and API layers. */
export const MESSAGE_LOOKBACK_HOURS = 24;
export const EVENT_PAST_DAYS = 30;
export const EVENT_FUTURE_DAYS = 365;
export const EVIDENCE_RETENTION_DAYS = 396;
export const MAX_ACTION_TITLE_LENGTH = 240;
export const MAX_ACTION_DESCRIPTION_LENGTH = 700;
export const MAX_EVIDENCE_LENGTH = 240;
export const MAX_ACTION_RESPONSIBLE_LENGTH = 120;

export function windowFrom(now = new Date()) {
  return {
    from: new Date(now.getTime() - EVENT_PAST_DAYS * 86400000),
    to: new Date(now.getTime() + EVENT_FUTURE_DAYS * 86400000),
  };
}

export function evidenceExpiry(now = new Date()) {
  return new Date(now.getTime() + EVIDENCE_RETENTION_DAYS * 86400000);
}
