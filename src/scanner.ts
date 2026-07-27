// Local, concrete mirror of the safi-studio-scanner public API this plugin uses.
//
// The scanner's published types don't always resolve in lint/CI environments, which
// makes every value imported from it `any` and trips a swarm of
// @typescript-eslint/no-unsafe-* warnings. Re-declaring the shapes we touch here, and
// pinning the functions we call to concrete signatures, keeps our own source fully
// typed no matter how the dependency resolves.

import { auditStream as rawAuditStream, render as rawRender } from "safi-studio-scanner";

export type Format = "json" | "md" | "html";
export type Status = "pass" | "fail" | "warn" | "info";
export type Severity = "error" | "warning" | "info";
export type ValueStatus = "ok" | "warn" | "bad" | "missing";

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

/** A single measured number or string, e.g. "Title length: 39 chars". */
export interface MetricValue {
	kind: "value";
	id: string;
	category: string;
	label: string;
	value: string | number | null;
	unit?: string;
	status?: ValueStatus;
	note?: string;
}

/** A measured table, e.g. every H1 on the page. Rows are capped; `total` is the real count. */
export interface MetricTable {
	kind: "table";
	id: string;
	category: string;
	label: string;
	columns: string[];
	rows: (string | number)[][];
	total: number;
	status?: ValueStatus;
	note?: string;
}

export type Metric = MetricValue | MetricTable;

export interface PageReport {
	url: string;
	status: number;
	score: number;
	findings: Finding[];
	/** Added in scanner 1.0.x. Older saved reports won't have it. */
	metrics?: Metric[];
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

// ---- progress events (scanner 1.0.x streaming API) ----

export interface AuditStartEvent {
	type: "audit_start";
	url: string;
	maxPages: number;
}
export interface PageFetchedEvent {
	type: "page_fetched";
	url: string;
	status: number;
	depth: number;
	index: number;
	ms: number;
}
export interface CrawlCompleteEvent {
	type: "crawl_complete";
	pages: number;
	checksTotal: number;
	ms: number;
}
export interface RenderCompleteEvent {
	type: "render_complete";
	provider: "browser" | "psi";
	rendered: number;
	pages: number;
	ms: number;
}
export interface CheckCompleteEvent {
	type: "check_complete";
	url: string;
	ruleId: string;
	status: Status;
	checksDone: number;
	checksTotal: number;
}
export interface PageCompleteEvent {
	type: "page_complete";
	url: string;
	index: number;
	pagesTotal: number;
	score: number;
	findings: number;
	metrics: number;
	ms: number;
}
export interface AuditCompleteEvent {
	type: "audit_complete";
	score: number;
	pages: number;
	checks: number;
	ms: number;
	report: AuditReport;
}

export type AuditEvent =
	| AuditStartEvent
	| PageFetchedEvent
	| CrawlCompleteEvent
	| RenderCompleteEvent
	| CheckCompleteEvent
	| PageCompleteEvent
	| AuditCompleteEvent;

export interface AuditStream extends AsyncIterable<AuditEvent> {
	finalReport(): Promise<AuditReport>;
}

// Pin the imported functions to our concrete signatures. When the dependency's
// types resolve these casts are no-ops; when they don't, they restore type safety.
export const auditStream = rawAuditStream as (
	startUrl: string,
	options?: Partial<AuditOptions>,
) => AuditStream;

export const render = rawRender as (report: AuditReport, format: Format) => string;
