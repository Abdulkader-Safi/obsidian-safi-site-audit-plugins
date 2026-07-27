import assert from "node:assert/strict";
import { test } from "node:test";
import {
	buildJson,
	buildNote,
	parseNote,
	runBaseName,
	siteFolderName,
} from "../src/report-file.ts";
import type { AuditReport } from "../src/scanner.ts";

const report: AuditReport = {
	startUrl: "https://example.com",
	generatedAt: "2026-06-28T15:30:00.000Z",
	pagesScanned: 2,
	score: 73,
	categories: [{ category: "core-seo", score: 80, pass: 4, fail: 1, warn: 0 }],
	pages: [
		{
			url: "https://example.com",
			status: 200,
			score: 73,
			findings: [
				{
					ruleId: "core-seo/title-present",
					category: "core-seo",
					severity: "error",
					title: "Missing title",
					status: "fail",
					message: "No <title> element",
				},
			],
			metrics: [
				{
					kind: "value",
					id: "core-seo/title-chars",
					category: "core-seo",
					label: "Title length",
					value: 0,
					unit: "chars",
					status: "bad",
				},
			],
		},
	],
};

test("buildNote writes frontmatter the dashboard list can read", () => {
	const note = buildNote(report);
	assert.match(note, /^---\n/);
	assert.match(note, /ssa_audit: true/);
	assert.match(note, /url: "https:\/\/example\.com"/);
	assert.match(note, /score: 73/);
});

test("buildNote no longer embeds the report JSON in the note", () => {
	const note = buildNote(report);
	assert.doesNotMatch(note, /ssa-report-json/);
	// A 100-page audit used to inline megabytes of JSON here, which is what made
	// opening the note slow. The note is now just frontmatter plus Markdown.
	assert.equal(parseNote(note), null);
});

test("buildJson round-trips the full report, metrics included", () => {
	assert.deepEqual(JSON.parse(buildJson(report)) as AuditReport, report);
});

test("parseNote still reads audits saved by earlier versions", () => {
	const legacy = `---\nssa_audit: true\n---\n\n# Old audit\n\n\`\`\`ssa-report-json\n${JSON.stringify(report)}\n\`\`\`\n`;
	assert.deepEqual(parseNote(legacy), report);
});

test("parseNote returns null when there is no embedded report", () => {
	assert.equal(parseNote("# just a note\n\nno data here"), null);
});

test("siteFolderName is the hostname, safe for a vault path", () => {
	assert.equal(siteFolderName(report), "example.com");
	assert.equal(siteFolderName({ ...report, startUrl: "not a url" }), "not-a-url");
	assert.equal(siteFolderName({ ...report, startUrl: "" }), "site");
});

test("runBaseName is a minute-precision timestamp shared by all three exports", () => {
	assert.equal(runBaseName(report), "2026-06-28-15-30");
	assert.equal(runBaseName({ ...report, generatedAt: "nonsense" }), "audit");
});
