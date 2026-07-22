import { z } from "zod";

export type CreatePostInput = {
  type: "partner" | "talent" | "project" | "funding";
  title: string;
  city: string;
  tags: string[];
  contactPrivate: string;
  body: Record<string, unknown>;
};

const titleSchema = z.string().min(1).max(50);
const introSchema = z.string().min(1).max(300);
const techNeedsShortSchema = z.string().min(1).max(200);
const techNeedsLongSchema = z.string().min(1).max(300);
const teamSchema = z.string().min(1).max(200);
const nonEmptyStringArray = z.array(z.string().min(1)).min(1);

const partnerBodySchema = z.object({
  projectStage: z.string().min(1),
  intro: introSchema,
  techNeeds: techNeedsShortSchema,
  cooperationModes: nonEmptyStringArray,
  equitySalary: z.string().optional(),
  currentTeam: z.string().optional(),
});

const talentBodySchema = z.object({
  status: z.string().min(1),
  background: introSchema,
  timeCommitment: z.string().min(1),
  desiredModes: nonEmptyStringArray,
  portfolio: z.string().optional(),
});

const projectBodySchema = z.object({
  projectKind: z.string().min(1),
  techNeeds: techNeedsLongSchema,
  workMode: z.string().min(1),
  budget: z.string().optional(),
  duration: z.string().optional(),
});

const fundingBodySchema = z.object({
  stage: z.string().min(1),
  amount: z.string().min(1),
  intro: introSchema,
  team: teamSchema,
  equity: z.string().optional(),
});

const baseFields = {
  title: titleSchema,
  city: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  contactPrivate: z.string().min(1),
};

const postSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("partner"), ...baseFields, body: partnerBodySchema }),
  z.object({ type: z.literal("talent"), ...baseFields, body: talentBodySchema }),
  z.object({ type: z.literal("project"), ...baseFields, body: projectBodySchema }),
  z.object({ type: z.literal("funding"), ...baseFields, body: fundingBodySchema }),
]);

export function parsePostInput(
  raw: unknown,
): { ok: true; data: CreatePostInput } | { ok: false; error: string } {
  const result = postSchema.safeParse(raw);
  if (!result.success) {
    const error = result.error.issues.map((issue) => issue.message).join("; ");
    return { ok: false, error: error || "Invalid input" };
  }
  return {
    ok: true,
    data: {
      ...result.data,
      body: result.data.body as Record<string, unknown>,
    },
  };
}
