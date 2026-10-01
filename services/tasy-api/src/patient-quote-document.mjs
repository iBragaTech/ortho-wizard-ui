import { build } from "esbuild";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { ApiError } from "./errors.mjs";

// Reuse the exact template used by “Gerar arquivo do paciente”. Inline the logo
// so the renderer never needs to access the frontend or an external resource.
let template;
async function loadTemplate() {
  if (!template) {
    template = (async () => {
      const result = await build({
        entryPoints: [
          fileURLToPath(new URL("../../../src/lib/quote-document.ts", import.meta.url)),
        ],
        absWorkingDir: fileURLToPath(new URL("../../../", import.meta.url)),
        bundle: true,
        write: false,
        format: "esm",
        platform: "node",
        loader: { ".png": "dataurl" },
        logLevel: "silent",
      });
      const module = await import(
        `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`
      );
      return module.buildQuoteHtml;
    })().catch((error) => {
      template = undefined;
      throw error;
    });
  }
  return template;
}

export async function buildPatientQuoteHtml(snapshot) {
  const buildHtml = await loadTemplate();
  return buildHtml(
    {
      ...snapshot.data,
      id: snapshot.id,
      numero: snapshot.numero,
      status: snapshot.status,
      data: snapshot.created_at
        ? new Date(snapshot.created_at).toLocaleDateString("pt-BR", { timeZone: "UTC" })
        : "—",
    },
    snapshot.institution || {},
  );
}

let active = 0;
export async function buildPatientQuotePdf(snapshot) {
  if (active >= 2)
    throw new ApiError(
      503,
      "PDF_BUSY",
      "Há outros PDFs sendo preparados. Tente novamente em instantes.",
    );
  active++;
  let browser;
  try {
    const html = await buildPatientQuoteHtml(snapshot);
    browser = await chromium.launch({ headless: true, timeout: 15000 });
    const context = await browser.newContext({
      javaScriptEnabled: false,
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      serviceWorkers: "block",
    });
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 10000 });
    return await page.pdf({
      format: "A4",
      preferCSSPageSize: true,
      printBackground: true,
      timeout: 10000,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      503,
      "PDF_UNAVAILABLE",
      "Não foi possível gerar o arquivo do paciente. Tente novamente ou contate o suporte.",
    );
  } finally {
    await browser?.close().catch(() => {});
    active--;
  }
}
