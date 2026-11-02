/** Deployment aliases are case-sensitive; retain the original names as fallbacks. */
export function aemetPriorityKeys(env: Record<string, string | undefined>): string[] {
  return [1, 2, 3, 4, 5].map(index =>
    env[`Opendata${index}`]?.trim() || env[`AEMET_PRIORITY_KEY_${index}`]?.trim() || '',
  );
}

/** Keep priority tiers separate; rotate within a tier to distribute requests. */
export function aemetKeyOrder(priority: string[], backup: string[], turn: number, override?: string|null): string[] {
  const rotate=(values:string[])=>{
    const list=[...new Set(values.map(v=>v.trim()).filter(Boolean))];
    if(!list.length) return list;
    const offset=turn%list.length;
    return [...list.slice(offset),...list.slice(0,offset)];
  };
  return [...new Set([...rotate(priority),...(override?[override]:[]),...rotate(backup)])];
}