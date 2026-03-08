export interface MatchingCorrectPair {
	leftMatching: string;
	rightMatching: string;
	explainRight?: string;
	explainWrong?: string;
}

export interface MatchingConfig {
	leftMatchingItems: Array<string>;
	rightMatchingItems: Array<string>;
	correctPairs: MatchingCorrectPair[];
}

export interface AnswerPair {
	leftMatching: string;
	rightMatching: string;
}
