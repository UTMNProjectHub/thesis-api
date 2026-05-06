import { t } from "elysia";

// User
export const UserResponse = t.Object({
  id: t.String(),
  email: t.String(),
  full_name: t.Nullable(t.String()),
  avatar_url: t.Nullable(t.String()),
  date_created: t.Nullable(t.Date()),
  usersToRoles: t.Array(t.Object({
    role: t.Object({
      id: t.Number(),
      title: t.String(),
      slug: t.String(),
      description: t.Nullable(t.String()),
      date_created: t.Nullable(t.Date()),
    }),
  })),
});

export const RoleResponse = t.Object({
  id: t.Number(),
  title: t.String(),
  slug: t.String(),
  description: t.Nullable(t.String()),
  date_created: t.Nullable(t.Date()),
});

// Quiz
export const QuizResponse = t.Object({
  id: t.String(),
  name: t.String(),
  type: t.String(),
  description: t.String(),
  maxSessions: t.Number(),
  themeId: t.Nullable(t.Number()),
});

// Summary
export const SummaryResponse = t.Object({
  id: t.Number(),
  subjectId: t.Nullable(t.Number()),
  themeId: t.Nullable(t.Number()),
  fileId: t.String(),
});

// Stats
export const StatsResponse = t.Object({
  users: t.Number(),
  subjects: t.Number(),
  themes: t.Number(),
  quizes: t.Number(),
  summaries: t.Number(),
});

export const ActivityPoint = t.Object({
  day: t.String(),
  активность: t.Number(),
});

export const ContentItem = t.Object({
  name: t.String(),
  value: t.Number(),
});

export const UserGrowthPoint = t.Object({
  month: t.String(),
  users: t.Number(),
});

export const DetailedStatsResponse = t.Object({
  activityByDay: t.Array(ActivityPoint),
  contentDistribution: t.Array(ContentItem),
  userGrowth: t.Array(UserGrowthPoint),
});

// Subject
export const SubjectResponse = t.Object({
  id: t.Number(),
  name: t.String(),
  shortName: t.String(),
  description: t.Nullable(t.String()),
  yearStart: t.Number(),
  yearEnd: t.Number(),
});

// Theme
export const ThemeResponse = t.Object({
  id: t.Number(),
  name: t.String(),
  description: t.Nullable(t.String()),
  subjectId: t.Number(),
  subject: t.Optional(SubjectResponse),
});

export const CreateThemeBody = t.Object({
  name: t.String(),
  description: t.Optional(t.String()),
  subjectId: t.Number(),
});

export const UpdateThemeBody = CreateThemeBody;

// Admin
export const AdminModel = {
  userResponse: UserResponse,
  roleResponse: RoleResponse,
  quizResponse: QuizResponse,
  summaryResponse: SummaryResponse,
  statsResponse: StatsResponse,
  subjectResponse: SubjectResponse,
  createThemeBody: CreateThemeBody, 
  themeResponse: ThemeResponse,
  updateThemeBody: UpdateThemeBody,
  detailedStatsResponse: DetailedStatsResponse,
};