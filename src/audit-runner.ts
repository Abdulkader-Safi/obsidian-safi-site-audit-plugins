import { audit, type AuditOptions, type AuditReport } from "safi-studio-scanner";
import { withObsidianFetch } from "./fetch-shim";
import type { SafiSiteAuditSettings } from "./settings";

export interface RunOptions {
	url: string;
	maxPages?: number;
}

/** Empty/invalid page count falls back to the settings default. */
export function resolvePages(value: number | undefined, fallback: number): number {
	const n = value && value > 0 ? Math.floor(value) : fallback;
	return Math.max(n, 1);
}

export async function runAudit(opts: RunOptions, settings: SafiSiteAuditSettings): Promise<AuditReport> {
	const options: Partial<AuditOptions> = {
		format: "md",
		maxPages: resolvePages(opts.maxPages, settings.defaultMaxPages),
		concurrency: settings.concurrency,
	};
	if (settings.userAgent.trim()) options.userAgent = settings.userAgent.trim();
	if (settings.psiKey.trim()) options.psiKey = settings.psiKey.trim();

	return withObsidianFetch(() => audit(opts.url, options));
}
