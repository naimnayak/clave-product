import { AI_TIMEOUT_MS, apiClient } from '@/services/apiClient'

export interface InterviewQuestion {
  question: string
  category: string
  difficulty: string
  expectedKeyPoints: string[]
}

export interface InterviewEvaluation {
  score: number
  summary: string
  whatWorked: string[]
  improvementPoints: string[]
}

export interface InterviewAnswer {
  questionIndex: number
  question: string
  answer: string
  evaluation: InterviewEvaluation
}

export interface InterviewSession {
  sessionId: string
  role: string
  level: string
  focusSkills: string[]
  totalQuestions: number
  questionIndex: number
  answeredCount: number
  completed: boolean
  overallScore: number
  createdAt: string
  updatedAt: string
  questions?: InterviewQuestion[]
  answers?: InterviewAnswer[]
}

export interface StartInterviewInput {
  role: string
  level: string
  focusSkills: string[]
  totalQuestions: number
}

const path = (id: string) => `/ai/interview/sessions/${encodeURIComponent(id)}`

export const startInterview = (input: StartInterviewInput) =>
  apiClient.post<InterviewSession>('/ai/interview/sessions', input, AI_TIMEOUT_MS)

export const answerQuestion = (sessionId: string, answer: string) =>
  apiClient.post<InterviewSession & { evaluation: InterviewEvaluation }>(`${path(sessionId)}/answers`, { answer }, AI_TIMEOUT_MS)

export const getInterview = (sessionId: string) => apiClient.get<InterviewSession>(path(sessionId))

export const listInterviews = () => apiClient.get<InterviewSession[]>('/ai/interview/sessions?limit=6')

export const deleteInterview = (sessionId: string) => apiClient.delete(path(sessionId))
