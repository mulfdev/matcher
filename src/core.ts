interface TextRun {
    T: string;
}

interface TextItem {
    R: TextRun[];
    x: number;
    y: number;
}

interface Page {
    Texts: TextItem[];
}

interface PDFJson {
    Pages: Page[];
}

export function formatStructuredText(json: PDFJson): {
    sections: { title: string; content: string[] }[];
} {
    const rawLines: { y: number; text: string }[] = [];

    // Step 1: Extract lines grouped by Y position
    for (const page of json.Pages) {
        const lines: Record<number, { x: number; text: string }[]> = {};

        for (const item of page.Texts) {
            const y = Math.round(item.y * 10);
            const x = item.x;
            const str = item.R.map((r) => decodeURIComponent(r.T)).join('');

            if (!lines[y]) lines[y] = [];
            lines[y].push({ x, text: str });
        }

        const sortedY = Object.keys(lines)
            .map((k) => parseInt(k))
            .sort((a, b) => a - b);

        for (const y of sortedY) {
            const lineItems = lines[y].sort((a, b) => a.x - b.x);
            const lineText = lineItems.map((item) => item.text).join(' ');
            rawLines.push({ y, text: lineText.trim() });
        }
    }

    // Step 2: Group lines by sections
    const sectionKeywords = ['SKILLS', 'EXPERIENCE', 'PROJECTS', 'EDUCATION', 'NOTABLE PROJECTS'];
    const sections: { title: string; content: string[] }[] = [];
    let currentSection = { title: 'General', content: [] };

    for (const { text } of rawLines) {
        const cleanText = text.trim();
        const upperText = cleanText.toUpperCase();

        const isHeading =
            sectionKeywords.some((keyword) => upperText.startsWith(keyword)) ||
            /^[A-Z\s]{5,}$/.test(upperText); // all caps, probably a heading

        if (isHeading) {
            // Start new section
            if (currentSection.content.length) {
                sections.push(currentSection);
            }
            currentSection = {
                title: cleanText.replace(/●/g, '').trim(),
                content: [],
            };
        } else {
            currentSection.content.push(cleanText);
        }
    }

    // Add the last section
    if (currentSection.content.length) {
        sections.push(currentSection);
    }

    return { sections };
}
