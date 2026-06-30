// Local, concrete mirror of the safi-studio-scanner public API this plugin uses.
//
// The scanner is a git dependency. Its published types don't always resolve in
// lint/CI environments, which makes every value imported from it `any` and trips
// a swarm of @typescript-eslint/no-unsafe-* warnings. Re-declaring the shapes we
// touch here, and pinning the two functions we call to concrete signatures, keeps
// our own source fully typed no matter how the dependency resolves.

import { audit as rawAudit, render as rawRender } from "safi-studio-scanner";

export type Format = "json" | "md" | "html";
export type Status = "pass" | "fail" | "warn" | "info";
export type Severity = "error" | "warning" | "info";

export interface Finding {
	ruleId: string;
	category: string;
	severity: Severity;
	title: string;
	status: Status;
	message: string;
	details?: string;
	evidence?: string;
	fix?: string;
}

export interface PageReport {
	url: string;
	status: number;
	score: number;
	findings: Finding[];
}

export interface CategoryScore {
	category: string;
	score: number;
	pass: number;
	fail: number;
	warn: number;
}

export interface AuditReport {
	startUrl: string;
	generatedAt: string;
	pagesScanned: number;
	score: number;
	categories: CategoryScore[];
	pages: PageReport[];
}

export interface AuditOptions {
	format: Format;
	out?: string;
	only?: string[];
	skip?: string[];
	timeout: number;
	userAgent: string;
	maxPages: number;
	concurrency: number;
	maxDepth: number;
	browser: boolean;
	psiKey?: string;
	psiMaxPages: number;
}

// Pin the imported functions to our concrete signatures. When the dependency's
// types resolve these casts are no-ops; when they don't, they restore type safety.
export const audit = rawAudit as (
	startUrl: string,
	options?: Partial<AuditOptions>,
) => Promise<AuditReport>;

export const render = rawRender as (report: AuditReport, format: Format) => string;
