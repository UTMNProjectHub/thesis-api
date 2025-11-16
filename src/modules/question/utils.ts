/**
 * Simple seeded random number generator
 * Uses Linear Congruential Generator (LCG) algorithm
 */
class SeededRandom {
  private seed: number;

  constructor(seed: string | number) {
    // Convert string seed to number
    if (typeof seed === "string") {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      this.seed = Math.abs(hash);
    } else {
      this.seed = Math.abs(seed);
    }
  }

  next(): number {
    // LCG parameters (same as used in many programming languages)
    this.seed = (this.seed * 1664525 + 1013904223) % Math.pow(2, 32);
    return this.seed / Math.pow(2, 32);
  }
}

/**
 * Fisher-Yates shuffle algorithm with seed
 * Shuffles array in-place using seeded random number generator
 */
export function shuffleWithSeed<T>(array: T[], seed: string | number): T[] {
  const shuffled = [...array]; // Create a copy to avoid mutating original
  const rng = new SeededRandom(seed);

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

/**
 * Matching question configuration types
 */
export interface MatchingLeftItem {
  id: string;
  text: string;
}

export interface MatchingRightItem {
  id: string;
  text: string;
}

export interface MatchingCorrectPair {
  leftVariantId: string;
  rightVariantId: string;
  explainRight?: string;
  explainWrong?: string;
}

export interface MatchingConfig {
  leftItems: MatchingLeftItem[];
  rightItems: MatchingRightItem[];
  correctPairs: MatchingCorrectPair[];
}

/**
 * Prepare matching question for student by shuffling right items
 * Does not return correctPairs for security
 */
export function getMatchingQuestionForStudent(
  config: MatchingConfig,
  seed: string | number,
): {
  leftItems: MatchingLeftItem[];
  rightItems: MatchingRightItem[];
} {
  const shuffledRightItems = shuffleWithSeed(config.rightItems, seed);

  return {
    leftItems: config.leftItems,
    rightItems: shuffledRightItems,
  };
}

