// Comprehensive achievement and progression system for training games

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  points: number
  conditions: AchievementCondition[]
  unlocked: boolean
  unlockedAt?: Date
  progress?: number
  maxProgress?: number
}

export interface AchievementCondition {
  type: 'score' | 'streak' | 'time' | 'accuracy' | 'games_played' | 'perfect_score' | 'speed' | 'consecutive' | 'questionsAnswered'
  operator: 'gte' | 'lte' | 'eq'
  value: number
  gameType?: string
}

export interface GameStats {
  score: number
  accuracy: number
  timeSpent: number
  streak: number
  questionsAnswered: number
  correctAnswers: number
  gameType: string
  completedAt: Date
  perfectScore: boolean
  speedBonus: number
}

export interface PlayerProgress {
  totalGamesPlayed: number
  totalScore: number
  bestStreak: number
  averageAccuracy: number
  totalTimeSpent: number
  perfectGames: number
  achievements: Achievement[]
  currentLevel: number
  experiencePoints: number
  badges: string[]
}

// Predefined achievements
export const ACHIEVEMENTS: Achievement[] = [
  // Score-based achievements
  {
    id: 'first_score',
    name: 'Getting Started',
    description: 'Score your first points in any game',
    icon: '🎯',
    rarity: 'common',
    points: 50,
    conditions: [{ type: 'score', operator: 'gte', value: 1 }],
    unlocked: false
  },
  {
    id: 'high_scorer',
    name: 'High Scorer',
    description: 'Score 1000 points in a single game',
    icon: '🏆',
    rarity: 'rare',
    points: 200,
    conditions: [{ type: 'score', operator: 'gte', value: 1000 }],
    unlocked: false
  },
  {
    id: 'score_master',
    name: 'Score Master',
    description: 'Score 5000 points in a single game',
    icon: '👑',
    rarity: 'epic',
    points: 500,
    conditions: [{ type: 'score', operator: 'gte', value: 5000 }],
    unlocked: false
  },

  // Streak-based achievements
  {
    id: 'streak_starter',
    name: 'On a Roll',
    description: 'Get a 5-question streak',
    icon: '🔥',
    rarity: 'common',
    points: 75,
    conditions: [{ type: 'streak', operator: 'gte', value: 5 }],
    unlocked: false
  },
  {
    id: 'streak_master',
    name: 'Unstoppable',
    description: 'Get a 15-question streak',
    icon: '⚡',
    rarity: 'rare',
    points: 300,
    conditions: [{ type: 'streak', operator: 'gte', value: 15 }],
    unlocked: false
  },
  {
    id: 'streak_legend',
    name: 'Legendary Streak',
    description: 'Get a 25-question streak',
    icon: '🌟',
    rarity: 'legendary',
    points: 1000,
    conditions: [{ type: 'streak', operator: 'gte', value: 25 }],
    unlocked: false
  },

  // Accuracy achievements
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Complete a game with 100% accuracy',
    icon: '💎',
    rarity: 'rare',
    points: 250,
    conditions: [{ type: 'perfect_score', operator: 'eq', value: 1 }],
    unlocked: false
  },
  {
    id: 'accuracy_master',
    name: 'Sharp Shooter',
    description: 'Maintain 95%+ accuracy over 5 games',
    icon: '🎯',
    rarity: 'epic',
    points: 400,
    conditions: [
      { type: 'accuracy', operator: 'gte', value: 95 },
      { type: 'games_played', operator: 'gte', value: 5 }
    ],
    unlocked: false
  },

  // Speed achievements
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Answer questions with average response time under 3 seconds',
    icon: '💨',
    rarity: 'rare',
    points: 200,
    conditions: [{ type: 'speed', operator: 'lte', value: 3 }],
    unlocked: false
  },
  {
    id: 'lightning_fast',
    name: 'Lightning Fast',
    description: 'Answer 10 questions in under 1.5 seconds each',
    icon: '⚡',
    rarity: 'epic',
    points: 350,
    conditions: [
      { type: 'speed', operator: 'lte', value: 1.5 },
      { type: 'questionsAnswered', operator: 'gte', value: 10 }
    ],
    unlocked: false
  },

  // Game-specific achievements
  {
    id: 'millionaire_winner',
    name: 'Millionaire!',
    description: 'Win the millionaire game',
    icon: '💰',
    rarity: 'legendary',
    points: 1000,
    conditions: [
      { type: 'score', operator: 'gte', value: 1000000, gameType: 'millionaire' }
    ],
    unlocked: false
  },
  {
    id: 'bingo_master',
    name: 'Bingo Master',
    description: 'Get full card bingo in under 5 minutes',
    icon: '🎪',
    rarity: 'epic',
    points: 400,
    conditions: [
      { type: 'time', operator: 'lte', value: 300, gameType: 'bingo' },
      { type: 'perfect_score', operator: 'eq', value: 1, gameType: 'bingo' }
    ],
    unlocked: false
  },
  {
    id: 'speed_round_champion',
    name: 'Speed Champion',
    description: 'Score 2000+ points in speed round',
    icon: '🏁',
    rarity: 'epic',
    points: 450,
    conditions: [
      { type: 'score', operator: 'gte', value: 2000, gameType: 'speedround' }
    ],
    unlocked: false
  },
  {
    id: 'document_detective',
    name: 'Document Detective',
    description: 'Find all critical differences without mistakes',
    icon: '🔍',
    rarity: 'rare',
    points: 300,
    conditions: [
      { type: 'perfect_score', operator: 'eq', value: 1, gameType: 'spotdifference' }
    ],
    unlocked: false
  },

  // Consistency achievements
  {
    id: 'consistent_player',
    name: 'Consistent Player',
    description: 'Play games for 7 consecutive days',
    icon: '📅',
    rarity: 'rare',
    points: 250,
    conditions: [{ type: 'consecutive', operator: 'gte', value: 7 }],
    unlocked: false
  },
  {
    id: 'dedicated_learner',
    name: 'Dedicated Learner',
    description: 'Complete 50 training games',
    icon: '📚',
    rarity: 'epic',
    points: 500,
    conditions: [{ type: 'games_played', operator: 'gte', value: 50 }],
    unlocked: false
  }
]

class AchievementSystem {
  private playerProgress: PlayerProgress = {
    totalGamesPlayed: 0,
    totalScore: 0,
    bestStreak: 0,
    averageAccuracy: 0,
    totalTimeSpent: 0,
    perfectGames: 0,
    achievements: ACHIEVEMENTS.map(a => ({ ...a })),
    currentLevel: 1,
    experiencePoints: 0,
    badges: []
  }

  private onAchievementUnlocked?: (achievement: Achievement) => void

  constructor(onAchievementUnlocked?: (achievement: Achievement) => void) {
    this.onAchievementUnlocked = onAchievementUnlocked
    this.loadProgress()
  }

  // Process game completion and check for achievements
  processGameCompletion(gameStats: GameStats): Achievement[] {
    this.updatePlayerProgress(gameStats)
    const newAchievements = this.checkAchievements(gameStats)

    // Award experience points
    this.awardExperiencePoints(gameStats)

    // Save progress
    this.saveProgress()

    return newAchievements
  }

  private updatePlayerProgress(gameStats: GameStats) {
    this.playerProgress.totalGamesPlayed++
    this.playerProgress.totalScore += gameStats.score
    this.playerProgress.bestStreak = Math.max(this.playerProgress.bestStreak, gameStats.streak)
    this.playerProgress.totalTimeSpent += gameStats.timeSpent

    // Update average accuracy
    const totalAccuracy = this.playerProgress.averageAccuracy * (this.playerProgress.totalGamesPlayed - 1) + gameStats.accuracy
    this.playerProgress.averageAccuracy = totalAccuracy / this.playerProgress.totalGamesPlayed

    if (gameStats.perfectScore) {
      this.playerProgress.perfectGames++
    }
  }

  private checkAchievements(gameStats: GameStats): Achievement[] {
    const newAchievements: Achievement[] = []

    for (const achievement of this.playerProgress.achievements) {
      if (achievement.unlocked) continue

      if (this.checkConditions(achievement.conditions, gameStats)) {
        achievement.unlocked = true
        achievement.unlockedAt = new Date()
        newAchievements.push(achievement)

        // Trigger callback
        if (this.onAchievementUnlocked) {
          this.onAchievementUnlocked(achievement)
        }
      }
    }

    return newAchievements
  }

  private checkConditions(conditions: AchievementCondition[], gameStats: GameStats): boolean {
    return conditions.every(condition => {
      if (condition.gameType && condition.gameType !== gameStats.gameType) {
        return false
      }

      let value: number
      switch (condition.type) {
        case 'score':
          value = gameStats.score
          break
        case 'streak':
          value = gameStats.streak
          break
        case 'time':
          value = gameStats.timeSpent
          break
        case 'accuracy':
          value = gameStats.accuracy
          break
        case 'games_played':
          value = this.playerProgress.totalGamesPlayed
          break
        case 'perfect_score':
          value = gameStats.perfectScore ? 1 : 0
          break
        case 'speed':
          value = gameStats.timeSpent / gameStats.questionsAnswered
          break
        case 'consecutive':
          // This would need additional tracking logic for consecutive days
          value = 0 // Placeholder
          break
        case 'questionsAnswered':
          value = gameStats.questionsAnswered
          break
        default:
          return false
      }

      switch (condition.operator) {
        case 'gte':
          return value >= condition.value
        case 'lte':
          return value <= condition.value
        case 'eq':
          return value === condition.value
        default:
          return false
      }
    })
  }

  private awardExperiencePoints(gameStats: GameStats) {
    let xpGained = 0

    // Base XP from score
    xpGained += Math.floor(gameStats.score / 100)

    // Bonus XP for accuracy
    if (gameStats.accuracy >= 90) xpGained += 50
    if (gameStats.accuracy === 100) xpGained += 100

    // Bonus XP for streaks
    xpGained += gameStats.streak * 10

    // Speed bonus XP
    xpGained += gameStats.speedBonus

    this.playerProgress.experiencePoints += xpGained

    // Level up check
    this.checkLevelUp()
  }

  private checkLevelUp() {
    const requiredXP = this.getRequiredXPForLevel(this.playerProgress.currentLevel + 1)
    if (this.playerProgress.experiencePoints >= requiredXP) {
      this.playerProgress.currentLevel++
      // Could trigger level up celebration
    }
  }

  private getRequiredXPForLevel(level: number): number {
    return Math.floor(1000 * Math.pow(1.5, level - 1))
  }

  // Get player statistics and progress
  getPlayerProgress(): PlayerProgress {
    return { ...this.playerProgress }
  }

  getUnlockedAchievements(): Achievement[] {
    return this.playerProgress.achievements.filter(a => a.unlocked)
  }

  getLockedAchievements(): Achievement[] {
    return this.playerProgress.achievements.filter(a => !a.unlocked)
  }

  getAchievementsByRarity(rarity: Achievement['rarity']): Achievement[] {
    return this.playerProgress.achievements.filter(a => a.rarity === rarity)
  }

  // Progress calculations
  getOverallProgress(): number {
    const totalAchievements = this.playerProgress.achievements.length
    const unlockedAchievements = this.getUnlockedAchievements().length
    return Math.round((unlockedAchievements / totalAchievements) * 100)
  }

  getNextLevelProgress(): { current: number; required: number; percentage: number } {
    const currentXP = this.playerProgress.experiencePoints
    const requiredXP = this.getRequiredXPForLevel(this.playerProgress.currentLevel + 1)
    const previousLevelXP = this.getRequiredXPForLevel(this.playerProgress.currentLevel)

    const progress = currentXP - previousLevelXP
    const needed = requiredXP - previousLevelXP
    const percentage = Math.min(100, Math.round((progress / needed) * 100))

    return {
      current: currentXP,
      required: requiredXP,
      percentage
    }
  }

  // Persistence
  private saveProgress() {
    try {
      localStorage.setItem('traind_player_progress', JSON.stringify(this.playerProgress))
    } catch (error) {
      console.warn('Could not save player progress:', error)
    }
  }

  private loadProgress() {
    try {
      const saved = localStorage.getItem('traind_player_progress')
      if (saved) {
        const progress = JSON.parse(saved)
        this.playerProgress = {
          ...this.playerProgress,
          ...progress,
          // Ensure achievements array is up to date with new achievements
          achievements: ACHIEVEMENTS.map(newAch => {
            const saved = progress.achievements?.find((a: Achievement) => a.id === newAch.id)
            return saved || newAch
          })
        }
      }
    } catch (error) {
      console.warn('Could not load player progress:', error)
    }
  }

  // Reset progress (for testing or user request)
  resetProgress() {
    this.playerProgress = {
      totalGamesPlayed: 0,
      totalScore: 0,
      bestStreak: 0,
      averageAccuracy: 0,
      totalTimeSpent: 0,
      perfectGames: 0,
      achievements: ACHIEVEMENTS.map(a => ({ ...a })),
      currentLevel: 1,
      experiencePoints: 0,
      badges: []
    }
    this.saveProgress()
  }
}

// Singleton instance
export const achievementSystem = new AchievementSystem()

// React hook
export const useAchievements = () => {
  return {
    processGameCompletion: achievementSystem.processGameCompletion.bind(achievementSystem),
    getPlayerProgress: achievementSystem.getPlayerProgress.bind(achievementSystem),
    getUnlockedAchievements: achievementSystem.getUnlockedAchievements.bind(achievementSystem),
    getLockedAchievements: achievementSystem.getLockedAchievements.bind(achievementSystem),
    getOverallProgress: achievementSystem.getOverallProgress.bind(achievementSystem),
    getNextLevelProgress: achievementSystem.getNextLevelProgress.bind(achievementSystem),
    resetProgress: achievementSystem.resetProgress.bind(achievementSystem)
  }
}

// Achievement notification component data
export interface AchievementNotification {
  achievement: Achievement
  show: boolean
  onClose: () => void
}