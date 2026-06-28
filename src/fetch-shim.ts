import { requestUrl, type RequestUrlParam } from "obsidian";

// The Safi-Studio-Scanner SDK calls the global `fetch` directly (src/http.ts) with
// `redirect:"manual"` and reads response headers. In Obsidian's renderer that hits CORS
// for cross-origin sites. Obsidian's requestUrl() bypasses CORS, so we patch
// globalThis.fetch with a requestUrl-backed shim for the duration of an audit.
//
// ponytail: requestUrl auto-follows redirects, so the SDK's redirect-chain counter always
// sees 0. That only affects the "redirect chain" rule; everything else works. Acceptable.

class ShimHeaders {
	private map: Record<string, string> = {};
	constructor(h: Record<string, string>) {
		for (const k in h) this.map[k.toLowerCase()] = h[k];
	}
	get(name: string): string | null {
		const v = this.map[name.toLowerCase()];
		return v === undefined ? null : v;
	}
	forEach(cb: (value: string, key: string) => void) {
		for (const k in this.map) cb(this.map[k], k);
	}
}

class ShimResponse {
	status: number;
	ok: boolean;
	headers: ShimHeaders;
	private bodyText: string;
	private resp: { json: unknown };

	constructor(resp: { status: number; headers: Record<string, string>; text: string; json: unknown }) {
		this.status = resp.status;
		this.ok = resp.status >= 200 && resp.status < 300;
		this.headers = new ShimHeaders(resp.headers ?? {});
		this.bodyText = resp.text ?? "";
		this.resp = resp;
	}
	async text(): Promise<string> {
		return this.bodyText;
	}
	async json(): Promise<unknown> {
		return this.resp.json;
	}
}

type FetchInit = {
	method?: string;
	headers?: Record<string, string> | Headers;
	body?: string;
};

export async function shimFetch(input: string | URL, init: FetchInit = {}): Promise<ShimResponse> {
	const url = typeof input === "string" ? input : input.toString();
	let headers: Record<string, string> = {};
	if (init.headers instanceof Headers) {
		init.headers.forEach((v, k) => (headers[k] = v));
	} else if (init.headers) {
		headers = { ...init.headers };
	}
	const param: RequestUrlParam = {
		url,
		method: init.method ?? "GET",
		headers,
		throw: false,
	};
	if (init.body != null) param.body = init.body;
	const resp = await requestUrl(param);
	return new ShimResponse(resp);
}

export async function withObsidianFetch<T>(fn: () => Promise<T>): Promise<T> {
	const original = globalThis.fetch;
	(globalThis as unknown as { fetch: unknown }).fetch = shimFetch;
	try {
		return await fn();
	} finally {
		globalThis.fetch = original;
	}
}
