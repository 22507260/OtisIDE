export type AICircuitItem = {
  ref?: string;
  type: string;
  x: number;
  y: number;
};

export type AIWireItem = {
  from: { component: string; pin: string };
  to: { component: string; pin: string };
  color?: string;
};

type ParsedCodeFence = {
  label: string;
  content: string;
};

const JSON_ARRAY_FIELD_ALIASES: Record<string, string[]> = {
  circuit: ['circuit', 'components'],
  wires: ['wires', 'connections', 'wireconnections'],
};

export const STRUCTURED_AI_RESPONSE_PATTERN =
  /```|"(?:circuit|components|wires|connections|wireConnections)"\s*:/i;

export const extractCodeFences = (content: string): ParsedCodeFence[] =>
  Array.from(content.matchAll(/```([a-zA-Z0-9_-]*)\s*\n([\s\S]*?)```/g)).map(
    (match) => ({
      label: match[1].trim().toLowerCase(),
      content: match[2].trim(),
    })
  );

const getJsonArrayFieldNames = (preferredLabel: string) =>
  Array.from(
    new Set([
      preferredLabel,
      ...(JSON_ARRAY_FIELD_ALIASES[preferredLabel] ?? []),
    ])
  );

const extractJsonArray = <T,>(
  parsed: unknown,
  preferredLabel: string,
  validator: (items: unknown[]) => items is T[]
): T[] | null => {
  if (Array.isArray(parsed) && validator(parsed)) {
    return parsed;
  }

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const candidate = parsed as Record<string, unknown>;
  for (const fieldName of getJsonArrayFieldNames(preferredLabel)) {
    const fieldValue = candidate[fieldName];
    if (Array.isArray(fieldValue) && validator(fieldValue)) {
      return fieldValue;
    }
  }

  return null;
};

const parseJsonArray = <T,>(
  rawContent: string,
  preferredLabel: string,
  validator: (items: unknown[]) => items is T[]
): T[] | null => {
  try {
    const parsed = JSON.parse(rawContent);
    return extractJsonArray(parsed, preferredLabel, validator);
  } catch {
    return null;
  }
};

export const isCircuitArray = (items: unknown[]): items is AICircuitItem[] =>
  items.every((item) => {
    const candidate = item as Record<string, unknown> | null;
    return (
      !!candidate &&
      typeof candidate.type === 'string' &&
      typeof candidate.x === 'number' &&
      typeof candidate.y === 'number'
    );
  });

export const isWireArray = (items: unknown[]): items is AIWireItem[] =>
  items.every((item) => {
    const candidate = item as Record<string, unknown> | null;
    const from = candidate?.from as Record<string, unknown> | undefined;
    const to = candidate?.to as Record<string, unknown> | undefined;
    return (
      !!candidate &&
      !!from &&
      !!to &&
      typeof from.component === 'string' &&
      typeof from.pin === 'string' &&
      typeof to.component === 'string' &&
      typeof to.pin === 'string'
    );
  });

export const extractTypedJsonArray = <T,>(
  content: string,
  preferredLabel: string,
  validator: (items: unknown[]) => items is T[]
): T[] | null => {
  const fences = extractCodeFences(content);
  const aliasLabels = getJsonArrayFieldNames(preferredLabel).filter(
    (label) => label !== preferredLabel
  );
  const orderedCandidates = [
    ...fences.filter((fence) => fence.label === preferredLabel),
    ...fences.filter((fence) => aliasLabels.includes(fence.label)),
    ...fences.filter((fence) => fence.label === 'json'),
    ...fences.filter((fence) => !fence.label),
  ];

  for (const candidate of orderedCandidates) {
    const parsed = parseJsonArray(candidate.content, preferredLabel, validator);
    if (parsed) return parsed;
  }

  const trimmed = content.trim();
  if (
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    (trimmed.startsWith('{') && trimmed.endsWith('}'))
  ) {
    return parseJsonArray(trimmed, preferredLabel, validator);
  }

  return null;
};

export const extractArduinoCode = (content: string): string | null => {
  const match = content.match(/```(?:arduino|cpp|c)\n([\s\S]*?)```/);
  return match ? match[1].trim() : null;
};
