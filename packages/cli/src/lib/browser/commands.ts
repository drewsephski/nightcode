import type { Page } from "playwright";
import { getPage, closeBrowser, closePage } from "./manager";
import { takeSnapshot } from "./snapshot";

export type BrowseAction =
  | { action: "goto"; url: string }
  | { action: "click"; selector: string }
  | { action: "fill"; selector: string; value: string }
  | { action: "snapshot" }
  | { action: "screenshot"; path?: string }
  | { action: "text" }
  | { action: "html"; selector?: string }
  | { action: "url" }
  | { action: "tabs" }
  | { action: "close" };

function isElementRef(selector: string): boolean {
  return /^@e\d+$/.test(selector);
}

export async function executeBrowse(input: BrowseAction): Promise<unknown> {
  switch (input.action) {
    case "close": {
      await closeBrowser();
      return { status: "closed" };
    }

    case "goto": {
      const page = await getPage();
      const response = await page.goto(input.url, { waitUntil: "domcontentloaded", timeout: 30000 });
      return {
        url: page.url(),
        title: await page.title(),
        status: response?.status() ?? 0,
      };
    }

    case "click": {
      const page = await getPage();
      if (isElementRef(input.selector)) {
        await clickRef(page, input.selector);
      } else {
        await page.click(input.selector);
      }
      return { clicked: input.selector };
    }

    case "fill": {
      const page = await getPage();
      if (isElementRef(input.selector)) {
        await fillRef(page, input.selector, input.value);
      } else {
        await page.fill(input.selector, input.value);
      }
      return { filled: input.selector };
    }

    case "snapshot": {
      const page = await getPage();
      return await takeSnapshot(page);
    }

    case "screenshot": {
      const page = await getPage();
      const buffer = await page.screenshot({ path: input.path, type: "png" });
      const base64 = buffer.toString("base64");
      return {
        mimeType: "image/png",
        data: base64,
        path: input.path ?? null,
      };
    }

    case "text": {
      const page = await getPage();
      return await page.locator(":scope").innerText();
    }

    case "html": {
      const page = await getPage();
      if (input.selector) {
        const el = page.locator(input.selector);
        const count = await el.count();
        if (count === 0) return { error: `Selector "${input.selector}" not found` };
        return await el.first().innerHTML();
      }
      return await page.locator("html").innerHTML();
    }

    case "url": {
      const page = await getPage();
      return { url: page.url(), title: await page.title() };
    }

    case "tabs": {
      const page = await getPage();
      const context = page.context();
      const pages = context.pages();
      const tabs = await Promise.all(
        pages.map(async (p, i) => ({
          index: i,
          url: p.url(),
          title: await p.title(),
          active: p === page,
        })),
      );
      return { tabs };
    }

    default:
      throw new Error(`Unknown browse action: ${(input as { action: string }).action}`);
  }
}

async function resolveRef(page: Page, ref: string) {
  const snapshot = await page.locator(":scope").ariaSnapshot();
  const lines = snapshot.split("\n").filter(l => l.trim());
  const refMap = new Map<string, { role: string; name: string }>();
  let counter = 1;

  for (const line of lines) {
    const match = line.trim().match(/^-\s+(\w+)\s+"([^"]+)"/);
    if (match) {
      const role = match[1];
      const name = match[2];
      const currentRef = `@e${counter++}`;
      refMap.set(currentRef, { role, name });
    }
  }

  const info = refMap.get(ref);
  if (!info) {
    throw new Error(`Element ref ${ref} not found. Take a snapshot first to refresh.`);
  }

  const locators = page.getByRole(info.role as any, { name: info.name, exact: true });
  const count = await locators.count();

  if (count === 0) {
    throw new Error(`Element ${ref} (${info.role} "${info.name}") not found on page`);
  }

  return count === 1 ? locators.first() : locators;
}

async function clickRef(page: Page, ref: string): Promise<void> {
  const element = await resolveRef(page, ref);
  await element.click();
}

async function fillRef(page: Page, ref: string, value: string): Promise<void> {
  const element = await resolveRef(page, ref);
  await element.fill(value);
}
