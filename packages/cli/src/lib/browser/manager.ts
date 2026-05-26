import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

let browserInstance: Browser | null = null;
let contextInstance: BrowserContext | null = null;
let pageInstance: Page | null = null;
let active = false;

export function isBrowserActive(): boolean {
  return active;
}

export async function getPage(): Promise<Page> {
  if (pageInstance && !pageInstance.isClosed()) {
    return pageInstance;
  }

  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }

  if (!contextInstance) {
    contextInstance = await browserInstance.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    });
  }

  pageInstance = await contextInstance.newPage();
  active = true;
  return pageInstance;
}

export async function closeBrowser(): Promise<void> {
  active = false;
  pageInstance = null;
  contextInstance = null;

  if (browserInstance) {
    try {
      await browserInstance.close();
    } catch {
      // ignore cleanup errors
    }
    browserInstance = null;
  }
}

export async function closePage(page: Page): Promise<void> {
  try {
    await page.close();
  } catch {
    // ignore
  }
  if (pageInstance === page) {
    pageInstance = null;
  }
}
