export interface ReviewToken {
	type: "word" | "separator";
	text: string;
}

const WORD_REGEX = /[A-Za-z0-9]+(?:'[A-Za-z0-9]+)*/g;

export function getReviewText(raw: string): string {
	const withoutFrontmatter = stripFrontmatter(raw);
	return stripHtmlComments(withoutFrontmatter);
}

export function tokenizeReviewText(text: string): ReviewToken[] {
	const tokens: ReviewToken[] = [];
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	WORD_REGEX.lastIndex = 0;
	while ((match = WORD_REGEX.exec(text)) !== null) {
		if (match.index > lastIndex) {
			tokens.push({
				type: "separator",
				text: text.slice(lastIndex, match.index),
			});
		}

		tokens.push({
			type: "word",
			text: match[0],
		});

		lastIndex = match.index + match[0].length;
	}

	if (lastIndex < text.length) {
		tokens.push({
			type: "separator",
			text: text.slice(lastIndex),
		});
	}

	return tokens;
}

export function maskWord(word: string): string {
	return "_".repeat(word.length);
}

function stripFrontmatter(content: string): string {
	if (!content.startsWith("---")) {
		return content;
	}

	const lines = content.split("\n");
	if (lines.length < 2) {
		return content;
	}

	let endIndex = -1;
	for (let i = 1; i < lines.length; i += 1) {
		const line = lines[i]?.trim();
		if (line === "---" || line === "...") {
			endIndex = i;
			break;
		}
	}

	if (endIndex === -1) {
		return content;
	}

	return lines.slice(endIndex + 1).join("\n");
}

function stripHtmlComments(content: string): string {
	return content.replace(/<!--[\s\S]*?-->/g, (match) => match.replace(/[^\n]/g, " "));
}
