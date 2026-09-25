#!/usr/bin/env node
/**
 * Serves the text recognition engine from the app's own origin (#312): Tesseract.js otherwise fetches its
 * worker, its WebAssembly core and its language models from the jsDelivr CDN at run time, which would send
 * every person scanning a recipe to a third party and break offline.
 *
 * Copied from node_modules into `static/tesseract/` (git-ignored) before every dev and build, so no binary
 * sits in the repository and the files always match the installed versions:
 * - the worker, and ONE core build: SIMD + LSTM only, the one the `best_int` models need and every browser
 *   and Android WebView of the last years runs;
 * - the `4.0.0_best_int` model of each app language, the smallest reliable variant (0.7 to 3 MB gzipped).
 *   They are only fetched when a scan is started in that language, then kept by Tesseract in IndexedDB.
 *
 * `--prune-native` runs after `cap copy` (package.json `capacitor:copy:after`): the installed app keeps only
 * the French and English models, the others would add about 12 MB to every download for everybody.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const root = join(dirname(new URL(import.meta.url).pathname), '..');

const LANGUAGES = ['fra', 'eng', 'spa', 'deu', 'ita', 'por', 'rus', 'ara', 'chi_sim'];
/** Keep in step with `NATIVE_OCR_LANGUAGES` in src/lib/domain/ocr-languages.ts. */
const NATIVE_LANGUAGES = ['fra', 'eng'];
const CORE = 'tesseract-core-simd-lstm.wasm.js';

function copy(from, to) {
	if (existsSync(to) && statSync(to).size === statSync(from).size) return;
	mkdirSync(dirname(to), { recursive: true });
	copyFileSync(from, to);
}

function prune(publicDir) {
	const dir = join(publicDir, 'tesseract', 'lang');
	if (!existsSync(dir)) return;
	for (const file of readdirSync(dir)) {
		if (!NATIVE_LANGUAGES.some((language) => file === `${language}.traineddata.gz`)) rmSync(join(dir, file));
	}
}

if (process.argv.includes('--prune-native')) {
	const platform = process.env.CAPACITOR_PLATFORM_NAME;
	const publicDir =
		platform === 'ios'
			? join(root, 'ios', 'App', 'App', 'public')
			: join(root, 'android', 'app', 'src', 'main', 'assets', 'public');
	prune(publicDir);
} else {
	const out = join(root, 'static', 'tesseract');
	const tesseractDir = dirname(require.resolve('tesseract.js/package.json'));
	const coreDir = dirname(createRequire(join(tesseractDir, 'package.json')).resolve('tesseract.js-core/package.json'));

	copy(join(tesseractDir, 'dist', 'worker.min.js'), join(out, 'worker.min.js'));
	copy(join(coreDir, CORE), join(out, CORE));
	for (const language of LANGUAGES) {
		const dataDir = dirname(require.resolve(`@tesseract.js-data/${language}/package.json`));
		copy(join(dataDir, '4.0.0_best_int', `${language}.traineddata.gz`), join(out, 'lang', `${language}.traineddata.gz`));
	}
}
