import { z } from 'zod'

// parse-syllabus output
export const parseSyllabusOutputSchema = z.object({
  course_level: z.enum(['intro', 'intermediate', 'advanced']),
  exam_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  topics: z.array(
    z.object({
      title: z.string().max(150),
      parent_topic: z.string().nullable(),
      display_order: z.number().int(),
    })
  ).min(1).max(30),
})

export type ParseSyllabusOutput = z.infer<typeof parseSyllabusOutputSchema>

// decompose-topic output
export const decomposeTopicOutputSchema = z.array(
  z.object({
    title: z.string().max(150),
    difficulty: z.enum(['basic', 'intermediate', 'advanced']),
  })
).min(4).max(8)

export type DecomposeTopicOutput = z.infer<typeof decomposeTopicOutputSchema>

// start-session output
export const startSessionOutputSchema = z.object({
  learning_goal: z.string().max(200),
  socratic_question: z.string(),
})

export type StartSessionOutput = z.infer<typeof startSessionOutputSchema>

// submit-explanation output — discriminated union
export const submitExplanationContinueSchema = z.object({
  status: z.literal('continue'),
  socratic_question: z.string(),
})

export const submitExplanationMasterySchema = z.object({
  status: z.literal('mastery'),
  best_explanation: z.string(),
})

export const submitExplanationOutputSchema = z.discriminatedUnion('status', [
  submitExplanationContinueSchema,
  submitExplanationMasterySchema,
])

export type SubmitExplanationOutput = z.infer<typeof submitExplanationOutputSchema>
