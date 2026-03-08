import type { MatchingConfig } from "./types";

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
		this.seed = (this.seed * 1664525 + 1013904223) % 2 ** 32;
		return this.seed / 2 ** 32;
	}
}

/**
 * Fisher-Yates shuffle algorithm with seed
 * Shuffles array in-place using seeded random number generator
 */
export function shuffleWithSeed<T>(array: T[], seed: string | number): T[] {
	const shuffled = [
		...array,
	]; // create a copy to avoid mutating original
	const rng = new SeededRandom(seed);

	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(rng.next() * (i + 1));
		[shuffled[i], shuffled[j]] = [
			shuffled[j],
			shuffled[i],
		];
	}

	return shuffled;
}

/**
 * shuffling func
 */
export function getMatchingQuestionForStudent(
	config: MatchingConfig,
	seed: string | number,
): {
	leftMatchingItems: Array<string>;
	rightMatchingItems: Array<string>;
} {
	const shuffledRightItems = shuffleWithSeed(config.rightMatchingItems, seed);

	return {
		leftMatchingItems: config.leftMatchingItems,
		rightMatchingItems: shuffledRightItems,
	};
}
