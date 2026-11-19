/**
 * Runs the real recipe import (the same service the API wires, LLM-first) over a list of recipe URLs and prints what it
 * extracted, how long it took and what each import cost in tokens. Run it once per model/commit and diff the outputs to
 * compare extraction quality and cost per call, e.g. the fal any-llm client against the Gemini structured-output client.
 *
 *   bun run import:compare <urls.txt> [--out result.json] [--price-in 0.10 --price-out 0.40]
 *
 * `urls.txt` holds one recipe URL per line (blank lines and `#` comments are skipped). Reads `.env`, so it needs
 * RECIPE_IMPORT_LLM_FIRST=true and GEMINI_API_KEY (or FAL_KEY on a commit that predates the Gemini client). `RECIPE_IMPORT_LLM_MODEL` picks the model.
 * `--price-in` / `--price-out` are US dollars per million input / output tokens from the provider's price list; without
 * them the cost column is left out and only token counts are reported. Token counts come from the provider's
 * `usageMetadata`, so a provider that does not return one (fal any-llm) reports none.
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';

import { config } from '../src/config';
import { dependencyContainer, registerDepdendencies } from '../src/dependencies';
import { DependencyToken } from '../src/dependencies/types';

interface GeminiUsage {
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

interface Row {
    url: string;
    ok: boolean;
    error?: string;
    title?: string;
    ingredients?: number;
    instructions?: number;
    ingredientNames?: string[];
    ms: number;
    calls: number;
    promptTokens: number;
    outputTokens: number;
    costUsd?: number;
}

const args = process.argv.slice(2);

const flag = (name: string): string | undefined => {
    const index = args.indexOf(name);

    return index === -1 ? undefined : args[index + 1];
};

const urlsFile = args[0];

if (!urlsFile || urlsFile.startsWith('--')) {
    console.error('usage: bun run import:compare <urls.txt> [--out result.json] [--price-in N --price-out N]');
    process.exit(2);
}

if (!config.get('recipeImportLlmFirst')) {
    console.error('set RECIPE_IMPORT_LLM_FIRST=true so the import goes through the LLM, which is what is compared');
    process.exit(2);
}

const priceIn = flag('--price-in') === undefined ? undefined : Number(flag('--price-in'));
const priceOut = flag('--price-out') === undefined ? undefined : Number(flag('--price-out'));
const outFile = flag('--out');

const urls = readFileSync(urlsFile, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

const usage = { calls: 0, promptTokens: 0, outputTokens: 0 };
const realFetch = globalThis.fetch;

globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const response = await realFetch(input, init);
    const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    if (target.includes('generativelanguage.googleapis.com')) {
        usage.calls += 1;

        const data: GeminiUsage = await response
            .clone()
            .json()
            .catch(() => ({}));

        usage.promptTokens += data.usageMetadata?.promptTokenCount ?? 0;
        usage.outputTokens += data.usageMetadata?.candidatesTokenCount ?? 0;
    }

    return response;
}) as typeof fetch;

registerDepdendencies();

const service = dependencyContainer.resolve(DependencyToken.RecipeImportService);

const results: Row[] = [];

for (const url of urls) {
    usage.calls = 0;
    usage.promptTokens = 0;
    usage.outputTokens = 0;
    const started = Date.now();

    try {
        const recipe = await service.importFromUrl(url);
        results.push({
            url,
            ok: true,
            title: recipe.title,
            ingredients: recipe.ingredients.length,
            instructions: recipe.instructions.length,
            ingredientNames: recipe.ingredients.map((ingredient) => ingredient.name),
            ms: Date.now() - started,
            ...usage,
            ...(priceIn !== undefined &&
                priceOut !== undefined && {
                    costUsd: (usage.promptTokens * priceIn + usage.outputTokens * priceOut) / 1_000_000,
                }),
        });
    } catch (error) {
        results.push({ url, ok: false, error: (error as Error).message, ms: Date.now() - started, ...usage });
    }
}

const json = JSON.stringify(
    { model: process.env.RECIPE_IMPORT_LLM_MODEL || '(default)', priceIn, priceOut, results },
    null,
    2
);

if (outFile) writeFileSync(outFile, json);

console.table(results.map(({ ingredientNames: _names, title: _title, error: _error, ...columns }) => columns));

const done = results.filter((result) => result.ok).length;

const total = (field: 'calls' | 'promptTokens' | 'outputTokens') =>
    results.reduce((sum, result) => sum + result[field], 0);

console.log(
    `${done}/${results.length} imported; ${total('calls')} LLM calls, ${total('promptTokens')} input and ${total('outputTokens')} output tokens`
);

if (!outFile) console.log(json);

process.exit(0);
