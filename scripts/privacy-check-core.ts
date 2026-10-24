export type PrivacyFinding = {
  reason: string;
  source: string;
};

export type PushUpdate = {
  localOid: string;
  localRef: string;
  remoteOid: string;
  remoteRef: string;
};

const UNIX_HOME_PATH = /\/(?:Users|home)\/[^/\s`"'<>]+(?:\/|(?=$|[\s`"'<>]))/i;
const WINDOWS_HOME_PATH =
  /[A-Z]:\\{1,2}Users\\{1,2}[^\\\s`"'<>]+(?:\\|(?=$|[\s`"'<>]))/i;

export function isPublicCommitEmail(email: string) {
  return /^(?:[a-z0-9+_.[\]-]+@users\.noreply\.github\.com|noreply@github\.com)$/i.test(
    email.trim(),
  );
}

function containsPrivateEmail(text: string) {
  const pattern =
    /[a-z0-9][a-z0-9._%+[\]-]*@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}/gi;
  return [...text.matchAll(pattern)].some((match) => {
    const email = match[0];
    const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
    const prefix = text.slice(0, match.index);
    if (/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>/?#]*$/i.test(prefix)) return false;
    return (
      !isPublicCommitEmail(email) &&
      email.toLowerCase() !== "noreply@anthropic.com" &&
      !/^(?:example\.(?:com|org|net)|(?:[^.]+\.)*(?:test|example|invalid|localhost))$/i.test(
        domain,
      )
    );
  });
}

export function normalizePrivacyValues(values: readonly string[]) {
  const normalized = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return [
    ...new Map(
      normalized.map((value) => [value.toLowerCase(), value]),
    ).values(),
  ];
}

export function findPrivacyFindings(
  text: string,
  source: string,
  blockedPatterns: readonly string[],
): PrivacyFinding[] {
  const findings: PrivacyFinding[] = [];
  const normalizedText = text.toLowerCase();

  blockedPatterns.forEach((pattern, index) => {
    if (normalizedText.includes(pattern.toLowerCase())) {
      findings.push({
        source,
        reason: `contains blocked private pattern #${index + 1}`,
      });
    }
  });

  if (UNIX_HOME_PATH.test(text) || WINDOWS_HOME_PATH.test(text)) {
    findings.push({
      source,
      reason: "contains an absolute home-directory path",
    });
  }

  if (containsPrivateEmail(text)) {
    findings.push({ source, reason: "contains a non-public email address" });
  }

  return findings;
}

export function isAllowedEmail(
  email: string,
  allowedEmails: readonly string[],
) {
  const normalizedEmail = email.trim().toLowerCase();
  return allowedEmails.some(
    (allowedEmail) => allowedEmail.toLowerCase() === normalizedEmail,
  );
}

export function extractIdentityEmail(identity: string) {
  return identity.match(/<([^<>]+)>/)?.[1] ?? null;
}

export function parsePushUpdates(input: string): PushUpdate[] {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const [localRef, localOid, remoteRef, remoteOid] = line.split(/\s+/);

      return localRef && localOid && remoteRef && remoteOid
        ? [{ localRef, localOid, remoteRef, remoteOid }]
        : [];
    });
}

export function isZeroOid(oid: string) {
  return /^0+$/.test(oid);
}
