export enum AchievementType {
  CUMULATIVE = 'cumulative', // Based on total count (e.g., attend 10 events)
  STREAK = 'streak', // Based on consecutive actions (e.g., 7-day login streak)
  TIME_BASED = 'time_based', // Based on time spent (e.g., 100 hours learning)
  MILESTONE = 'milestone', // Based on reaching specific milestones
  SOCIAL = 'social', // Based on social interactions
  CHALLENGE = 'challenge', // Based on completing challenges
  EXPLORATION = 'exploration', // Based on discovering new content
  MASTERY = 'mastery', // Based on skill mastery
  COLLABORATION = 'collaboration', // Based on team activities
  LEADERSHIP = 'leadership', // Based on leadership activities
}
