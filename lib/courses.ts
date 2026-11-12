import { z } from 'zod';

// Validation of a course (Training > Internal Courses)
const url = z.string().trim().max(1000).nullish().transform((v) => v || null).refine((v) => !v || /^https?:\/\//i.test(v), 'Video link must start with http:// or https://');
const opt = (n: number) => z.string().trim().max(n).nullish().transform((v) => v || null);
export const courseBody = z.object({
  section_id: z.string().uuid().nullish().transform((v) => v ?? null),
  title: z.string().trim().min(2).max(200), instructor: opt(200), description: opt(4000), video_url: url, server_path: opt(500),
  sessions: z.array(z.object({ title: z.string().trim().min(1).max(200), video_url: url })).max(100),
});
export type CourseBody = z.infer<typeof courseBody>;

