type KeyboardLayoutMapLike = Map<string, string>;

interface KeyRow {
	offset: number;
	codes: string[];
}

interface KeyPosition {
	row: number;
	x: number;
}

const KEY_ROWS: KeyRow[] = [
	{
		offset: 0,
		codes: ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP"],
	},
	{
		offset: 0.5,
		codes: ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL"],
	},
	{
		offset: 1,
		codes: ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM"],
	},
];

export class KeyboardLayout {
	private readonly charToCodes: Map<string, string[]>;
	private readonly neighborsByCode: Map<string, Set<string>>;

	private constructor(charToCodes: Map<string, string[]>, neighborsByCode: Map<string, Set<string>>) {
		this.charToCodes = charToCodes;
		this.neighborsByCode = neighborsByCode;
	}

	static async create(): Promise<KeyboardLayout> {
		let layoutMap: KeyboardLayoutMapLike | null = null;
		try {
			const keyboard = (navigator as Navigator & {
				keyboard?: { getLayoutMap?: () => Promise<KeyboardLayoutMapLike> };
			}).keyboard;
			if (keyboard?.getLayoutMap) {
				layoutMap = await keyboard.getLayoutMap();
			}
		} catch {
			layoutMap = null;
		}

		const positions = buildKeyPositions();
		const neighbors = buildNeighbors(positions);
		const charToCodes = buildCharToCodes(layoutMap, positions);
		return new KeyboardLayout(charToCodes, neighbors);
	}

	matchesLetter(event: KeyboardEvent, expectedLetter: string): boolean {
		const expected = expectedLetter.toLowerCase();
		const input = event.key?.toLowerCase();
		if (!input || input.length !== 1) {
			return false;
		}

		if (input === expected) {
			return true;
		}

		const expectedCodes = this.charToCodes.get(expected);
		if (!expectedCodes || expectedCodes.length === 0) {
			return false;
		}

		const inputCode = event.code;
		if (!inputCode) {
			return false;
		}

		for (const code of expectedCodes) {
			const neighbors = this.neighborsByCode.get(code);
			if (neighbors?.has(inputCode)) {
				return true;
			}
		}

		return false;
	}
}

function buildKeyPositions(): Map<string, KeyPosition> {
	const positions = new Map<string, KeyPosition>();
	KEY_ROWS.forEach((row, rowIndex) => {
		row.codes.forEach((code, index) => {
			positions.set(code, { row: rowIndex, x: index + row.offset });
		});
	});
	return positions;
}

function buildNeighbors(positions: Map<string, KeyPosition>): Map<string, Set<string>> {
	const neighbors = new Map<string, Set<string>>();
	const entries = Array.from(positions.entries());

	for (const [code, position] of entries) {
		const set = new Set<string>();
		for (const [otherCode, otherPosition] of entries) {
			if (code === otherCode) {
				continue;
			}
			const rowDiff = Math.abs(position.row - otherPosition.row);
			const xDiff = Math.abs(position.x - otherPosition.x);
			if (rowDiff <= 1 && xDiff <= 1) {
				set.add(otherCode);
			}
		}
		neighbors.set(code, set);
	}

	return neighbors;
}

function buildCharToCodes(
	layoutMap: KeyboardLayoutMapLike | null,
	positions: Map<string, KeyPosition>
): Map<string, string[]> {
	const charToCodes = new Map<string, string[]>();

	for (const code of positions.keys()) {
		const key = layoutMap?.get(code) ?? fallbackKeyForCode(code);
		if (!key || key.length !== 1) {
			continue;
		}

		const normalized = key.toLowerCase();
		if (!/^[a-z]$/.test(normalized)) {
			continue;
		}

		const existing = charToCodes.get(normalized);
		if (existing) {
			existing.push(code);
		} else {
			charToCodes.set(normalized, [code]);
		}
	}

	return charToCodes;
}

function fallbackKeyForCode(code: string): string | null {
	if (code.startsWith("Key") && code.length === 4) {
		return code.slice(3).toLowerCase();
	}
	return null;
}
