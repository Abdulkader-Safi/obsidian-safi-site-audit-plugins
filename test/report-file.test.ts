import assert from "node:assert/strict";
import { test } from "node:test";
import { auditFileName, buildNote, parseNote } from "../src/report-file.ts";
import type { AuditReport } from "safi-studio-scanner";

const report: AuditReport = {
	startUrl: "https://example.com",
	generatedAt: "2026-06-28T15:30:00.000Z",
	pagesScanned: 2,
	score: 73,
	categories: [{ category: "Core SEO", score: 80, pass: 4, fail: 1, warn: 0 }],
	pages: [
		{
			url: "https://example.com",
			status: 200,
			score: 73,
			findings: [
				{
					ruleId: "seo.title",
					category: "Core SEO",
					severity: "error",
					title: "Missing title",
					status: "fail",
					message: "No <title> element",
				},
			],
		},
	],
};

test("buildNote/parseNote round-trips the full report", () => {
	const note = buildNote(report);
	assert.match(note, /^---\n/);
	assert.match(note, /ssa_audit: true/);
	assert.deepEqual(parseNote(note), report);
});

test("parseNote returns null when there is no embedded report", () => {
	assert.equal(parseNote("# just a note\n\nno data here"), null);
});

test("auditFileName uses hostname plus a minute-precision timestamp", () => {
	assert.equal(auditFileName(report), "example.com-2026-06-28-15-30.md");
});
