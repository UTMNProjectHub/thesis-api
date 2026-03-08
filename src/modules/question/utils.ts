/**
 * Simple seeded random number generator
 * Uses Linear Congruential Generator (LCG) algorithm
 */
class SeededRandom {
	private seed: number;

	constructor(seed: string | number) {
		if (typeof seed === "string") {
			let hash = 0;
			for (let i = 0; i < seed.length; i++) {
				const char = seed.charCodeAt(i);
				hash = (hash << 5) - hash + char;
				hash = hash & hash;
			}
			this.seed = Math.abs(hash);
		} else {
			this.seed = Math.abs(seed);
		}
	}

	next(): number {
		this.seed = (this.seed * 1664525 + 1013904223) % 2 ** 32;
		return this.seed / 2 ** 32;
	}
}

/**
 * Fisher-Yates shuffle algorithm with seed
 */
export function shuffleWithSeed<T>(array: T[], seed: string | number): T[] {
	const shuffled = [...array];
	const rng = new SeededRandom(seed);

	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(rng.next() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}

	return shuffled;
}
