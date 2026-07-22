export function shouldRevealContact(input: {
  viewerId: string | null;
  authorId: string;
  unlockStatus: "pending" | "approved" | "rejected" | null;
}): boolean {
  if (!input.viewerId) return false;
  if (input.viewerId === input.authorId) return true;
  return input.unlockStatus === "approved";
}
