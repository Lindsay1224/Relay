export const NOISE_POLICY_VERSION = "noise-v1";
export const NOISE_EXCLUSION_TERMS = ["receipt", "sale", "order confirmation", "privacy policy"] as const;

const scheduleSignals = [
  ["school", /school/gi], ["teacher", /teacher/gi], ["field_trip", /field\s+trip/gi], ["practice", /practice/gi],
  ["game", /game/gi], ["coach", /coach/gi], ["dentist", /dentist/gi], ["orthodontist", /orthodontist/gi],
  ["doctor", /doctor/gi], ["pediatrician", /pediatrician/gi], ["appointment", /appointment/gi], ["conference", /conference/gi],
  ["dismissal", /dismissal/gi], ["holiday", /holiday/gi], ["calendar", /calendar/gi], ["time", /\b\d{1,2}:\d{2}\s*(?:a\.?m\.?|p\.?m\.?)\b/gi],
] as const;

export type NoiseDisposition = "included" | "excluded" | "needs_review";
export type NoiseDecision = {
  disposition: NoiseDisposition;
  sanitizedReason: "excluded_non_schedule" | "included_inbox_message" | "insufficient_schedule_signals";
  score: number;
  matchedSignals: string[];
  policyVersion: string;
};

export function evaluateNoise(subject: string, sender: string, text: string, hasCalendarAttachment = false): NoiseDecision {
  const combined = `${subject} ${sender} ${text}`;
  const exclusion = NOISE_EXCLUSION_TERMS.find((term) => combined.toLocaleLowerCase().includes(term));
  if (exclusion) return { disposition: "excluded", sanitizedReason: "excluded_non_schedule", score: 0, matchedSignals: [`excluded:${exclusion}`], policyVersion: NOISE_POLICY_VERSION };
  let score = 0;
  const matchedSignals: string[] = [];
  for (const [name, pattern] of scheduleSignals) {
    const matches = combined.match(pattern)?.length ?? 0;
    if (matches) { score += matches; matchedSignals.push(name); }
  }
  if (hasCalendarAttachment) { score += 3; matchedSignals.push("calendar_attachment"); }
  const included = score >= 2;
  return { disposition: included ? "included" : "needs_review", sanitizedReason: included ? "included_inbox_message" : "insufficient_schedule_signals", score, matchedSignals, policyVersion: NOISE_POLICY_VERSION };
}
