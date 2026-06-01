export type Grade = "A+" | "A" | "B+" | "B" | "C+" | "C";

export interface AnnualGoal {
  id: string;
  userId: string;
  year: number;
  title: string;
  currentLevel: string;
  reason: string;
  businessEffect: string;
  teamEffect: string;
  createdAt: string;
}

export interface MonthlyGoal {
  id: string;
  userId: string;
  year: number;
  month: number;
  annualGoalIds: string[];
  content: string;
  evaluation?: {
    grade: Grade;
    comment: string;
    evaluatedAt: string;
    evaluatedBy: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyEntry {
  id: string;
  userId: string;
  year: number;
  month: number;
  week: number;
  activities: string;
  concerns: string;
  feedbackNeeded: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkFeedbackStore {
  annualGoals: AnnualGoal[];
  monthlyGoals: MonthlyGoal[];
  weeklyEntries: WeeklyEntry[];
}
