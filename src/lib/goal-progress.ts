export type Semestres = [boolean, boolean, boolean, boolean];

export function goalProgress(checked: Semestres, active: Semestres): number {
  const count = active.filter(Boolean).length;
  if (count === 0) return 0;
  const completed = active.filter((enabled, i) => enabled && checked[i]).length;
  return Math.round((completed / count) * 100);
}