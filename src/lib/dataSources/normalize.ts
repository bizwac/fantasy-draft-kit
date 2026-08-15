// Sleeper, FFCalc, and user CSVs each spell player names slightly
// differently ("Jr.", punctuation, suffixes). This gives every source a
// shared join key so ADP/projection rows can be matched onto the Sleeper
// base record without a shared ID.
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[.'’]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const DST_ALIAS: Record<string, string> = {
  jax: "jac",
  jaguars: "jac",
  wsh: "was",
  washington: "was"
};

export function normalizeTeam(team: string | null | undefined): string {
  if (!team) return "FA";
  const t = team.toLowerCase().trim();
  return (DST_ALIAS[t] ?? t).toUpperCase();
}

export function playerMatchKey(name: string, position: string): string {
  return `${normalizeName(name)}|${position}`;
}
