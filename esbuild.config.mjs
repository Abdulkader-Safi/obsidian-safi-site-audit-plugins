import esbuild from "esbuild";
import esbuildSvelte from "esbuild-svelte";
import { sveltePreprocess } from "svelte-preprocess";
import { builtinModules } from "node:module";

const prod = process.argv[2] === "production";

const context = await esbuild.context({
	entryPoints: ["src/main.ts"],
	bundle: true,
	format: "cjs",
	target: "es2022",
	platform: "browser",
	logLevel: "info",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	outfile: "main.js",
	mainFields: ["svelte", "browser", "module", "main"],
	conditions: ["svelte", "browser", "import"],
	external: [
		"obsidian",
		"electron",
		"@codemirror/*",
		// browser-mode-only optional deps; never invoked in Obsidian (we run browser:false)
		"playwright",
		"playwright-core",
		"@axe-core/playwright",
		...builtinModules,
		...builtinModules.map((m) => `node:${m}`),
	],
	plugins: [
		esbuildSvelte({
			compilerOptions: { runes: true },
			preprocess: sveltePreprocess(),
		}),
	],
});

if (prod) {
	await context.rebuild();
	process.exit(0);
} else {
	await context.watch();
}
