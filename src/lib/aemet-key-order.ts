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