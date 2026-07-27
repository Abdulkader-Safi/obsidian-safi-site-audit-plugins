import { Events, type EventRef } from "obsidian";
import type { AuditReport } from "./scanner";
import type { AuditProgress } from "./audit-runner";

export type DashboardMode = "empty" | "new" | "detail";

/**
 * What the sidebar list and the dashboard tab both look at. They are separate
 * Obsidian views, so picking a run in one has to reach the other; this is the
 * single place that state lives, and both subscribe to its "change" event.
 */
export class AuditState extends Events {
	mode: DashboardMode = "empty";
	path: string | null = null;
	report: AuditReport | null = null;
	/** Kept across view switches so "Run again" can prefill the form. */
	draftUrl = "";
	running = false;
	progress: AuditProgress | null = null;

	showReport(path: string, report: AuditReport): void {
		this.mode = "detail";
		this.path = path;
		this.report = report;
		this.changed();
	}

	showRunForm(url = ""): void {
		if (url) this.draftUrl = url;
		this.mode = "new";
		this.path = null;
		this.report = null;
		this.changed();
	}

	setRunning(running: boolean, progress: AuditProgress | null = null): void {
		this.running = running;
		this.progress = progress;
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
