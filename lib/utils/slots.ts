export function formatBracketSlot(slot: string): string {
  if (slot.startsWith("W:")) return `Winner ${slot.slice(2)}`;
  if (slot.startsWith("L:")) return `Loser ${slot.slice(2)}`;
  return slot;
}
