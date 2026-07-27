import { auditStream, type AuditOptions, type AuditReport } from "./scanner";
import { withObsidianFetch } from "./fetch-shim";
import type { SafiSiteAuditSettings } from "./settings";

export interface RunOptions {
	url: string;
	maxPages?: number;
}

export type AuditPhase = "starting" | "crawling" | "checking" | "done";

export interface AuditProgress {
	phase: AuditPhase;
	/** Pages the crawler has fetched so far. */
	pagesFound: number;
	/** maxPages while crawling, then the real page count once the crawl finishes. */
	pagesTotal: number;
	/** Pages fully audited. */
	pagesDone: number;
	checksDone: number;
	checksTotal: number;
	/** Most recent URL the run touched, for a live line of context. */
	url: string;
}

export const EMPTY_PROGRESS: AuditProgress = {
	phase: "starting",
	pagesFound: 0,
	pagesTotal: 0,
	pagesDone: 0,
	checksDone: 0,
	checksTotal: 0,
	url: "",
};

/** Empty/invalid page count falls back to the settings default. */
export function resolvePages(value: number | undefined, fallback: number): number {
	const n = value && value > 0 ? Math.floor(value) : fallback;
	return Math.max(n, 1);
}

/** 0-100. Crawling is the first third of the run, checking the rest. */
export function progressPercent(p: AuditProgress): number {
	if (p.phase === "done") return 100;
	if (p.checksTotal > 0) return Math.round(33 + (p.checksDone / p.checksTotal) * 67);
	if (p.pagesTotal > 0) return Math.round(Math.min(p.pagesFound / p.pagesTotal, 1) * 33);
	return 0;
}

export async function runAudit(
	opts: RunOptions,
	settings: SafiSiteAuditSettings,
	onProgress?: (p: AuditProgress) => void,
): Promise<AuditReport> {
	const maxPages = resolvePages(opts.maxPages, settings.defaultMaxPages);
	const options: Partial<AuditOptions> = {
		format: "md",
		maxPages,
		concurrency: settings.concurrency,
	};
	if (settings.userAgent.trim()) options.userAgent = settings.userAgent.trim();
	if (settings.psiKey.trim()) options.psiKey = settings.psiKey.trim();

	return withObsidianFetch(async () => {
		const stream = auditStream(opts.url, options);
		const p: AuditProgress = { ...EMPTY_PROGRESS, phase: "crawling", pagesTotal: maxPages };
		onProgress?.({ ...p });

		for await (const event of stream) {
			switch (event.type) {
				case "page_fetched":
					p.pagesFound = event.index;
					p.url = event.url;
					break;
				case "crawl_complete":
					p.phase = "checking";
					p.pagesFound = event.pages;
					p.pagesTotal = event.pages;
					p.checksTotal = event.checksTotal;
					break;
				case "check_complete":
					p.checksDone = event.checksDone;
					p.checksTotal = event.checksTotal;
					break;
				case "page_complete":
					p.pagesDone = event.index;
					p.pagesTotal = event.pagesTotal;
					p.url = event.url;
					break;
				case "audit_complete":
					p.phase = "done";
					p.pagesDone = event.pages;
					break;
				default:
					continue;
			}
			onProgress?.({ ...p });
		}

		return stream.finalReport();
	});
}
