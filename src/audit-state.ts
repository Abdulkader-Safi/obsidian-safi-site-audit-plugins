import { Events, type EventRef } from "obsidian";
import type { AuditReport } from "./scanner";
import type { AuditProgress } from "./audit-runner";
import type { AuditListItem } from "./audit-store";

export type DashboardMode = "empty" | "new" | "loading" | "detail" | "failed";

export interface RunPoint {
	date: string;
	score: number;
}

/** The earlier run a report is compared against. */
export interface Comparison {
	path: string;
	date: string;
	report: AuditReport;
}

export interface ReportContext {
	/** Earlier runs of the same site, newest first. The compare picker lists these. */
	earlier: AuditListItem[];
	previous: Comparison | null;
	/** Oldest first, ending with the shown run. */
	history: RunPoint[];
}

const RECENT_PAGES = 6;

/**
 * What the sidebar list and the dashboard tab both look at. They are separate
 * Obsidian views, so picking a run in one has to reach the other; this is the
 * single place that state lives, and both subscribe to its "change" event.
 */
export class AuditState extends Events {
	mode: DashboardMode = "empty";
	path: string | null = null;
	report: AuditReport | null = null;
	context: ReportContext = { earlier: [], previous: null, history: [] };
	/** Site shown while a report loads, so the header is not blank. */
	loadingUrl = "";
	/** Kept across view switches so "Edit URL" can prefill the form. */
	draftUrl = "";
	running = false;
	runUrl = "";
	progress: AuditProgress | null = null;
	/** URLs the crawler touched most recently, newest first. */
	recent: string[] = [];
	error: { url: string; message: string } | null = null;

	showLoading(path: string, url: string): void {
		this.mode = "loading";
		this.path = path;
		this.loadingUrl = url;
		this.changed();
	}

	showReport(path: string, report: AuditReport, context: ReportContext): void {
		this.mode = "detail";
		this.path = path;
		this.report = report;
		this.context = context;
		this.error = null;
		this.changed();
	}

	setComparison(previous: Comparison | null): void {
		this.context = { ...this.context, previous };
		this.changed();
	}

	showRunForm(url = ""): void {
		if (url) this.draftUrl = url;
		this.mode = "new";
		this.path = null;
		this.report = null;
		this.changed();
	}

	showEmpty(): void {
		this.mode = "empty";
		this.path = null;
		this.report = null;
		this.changed();
	}

	showFailed(url: string, message: string): void {
		this.mode = "failed";
		this.path = null;
		this.report = null;
		this.error = { url, message };
		this.changed();
	}

	startRun(url: string): void {
		this.running = true;
		this.runUrl = url;
		this.progress = null;
		this.recent = [];
		this.error = null;
		this.changed();
	}

	setProgress(progress: AuditProgress): void {
		this.progress = progress;
		if (progress.url && progress.url !== this.recent[0]) {
			this.recent = [progress.url, ...this.recent.filter((u) => u !== progress.url)].slice(0, RECENT_PAGES);
		}
		this.changed();
	}

	endRun(): void {
		this.running = false;
		this.progress = null;
		this.changed();
	}

	/** Also what the list listens to when a finished run adds a note. */
	changed(): void {
		this.trigger("change");
	}

	onChange(cb: () => void): EventRef {
		return this.on("change", cb);
	}
}
