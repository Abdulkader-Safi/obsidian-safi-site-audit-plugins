import type { AuditReport, Severity, Status } from "safi-studio-scanner";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export function hostOf(url: string): string {
	try {
		return new URL(url).hostname || url;
	} catch {
		return url;
	}
}

export function formatDate(iso: string): string {
	const d = new Date(iso);
	if (isNaN(d.getTime())) return iso;
	return d.toLocaleString();
}

export function scoreVariant(score: number): BadgeVariant {
	if (score >= 80) return "default";
	if (score >= 50) return "secondary";
	return "destructive";
}

export function severityVariant(sev: Severity): BadgeVariant {
	if (sev === "error") return "destructive";
	if (sev === "warning") return "secondary";
	return "outline";
}

export function statusVariant(status: Status): BadgeVariant {
	if (status === "fail") return "destructive";
	if (status === "warn") return "secondary";
	if (status === "pass") return "default";
	return "outline";
}
