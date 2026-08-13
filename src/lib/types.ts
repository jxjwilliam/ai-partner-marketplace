export type RoleTag = "talent" | "founder" | "investor" | "other";
export type PostType = "partner" | "talent" | "project" | "funding";
export type PostStatus = "active" | "hidden";
export type UnlockStatus = "pending" | "approved" | "rejected";

export type User = {
  id: string;
  phone: string;
  nickname: string | null;
  city: string | null;
  roleTag: RoleTag | null;
  bio: string | null;
  skills: string[];
  yearsExperience: number | null;
  isVerified: boolean;
  isAdmin: boolean;
  createdAt: Date;
};

export type Post = {
  id: string;
  authorId: string;
  type: PostType;
  title: string;
  city: string;
  tags: string[];
  bodyJson: Record<string, unknown>;
  contactPrivate: string;
  status: PostStatus;
  viewCount: number;
  createdAt: Date;
  bumpedAt: Date;
};

export type ContactRequest = {
  id: string;
  postId: string;
  requesterId: string;
  message: string;
  status: UnlockStatus;
  createdAt: Date;
  decidedAt: Date | null;
};

export type OtpCode = {
  id: string;
  phone: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
  ip: string | null;
};

export type Session = {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
};
