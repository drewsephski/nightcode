import type { Page } from "playwright";

const INTERACTIVE_ROLES = new Set([
  "button", "link", "checkbox", "radio", "textbox", "combobox",
  "listbox", "option", "menuitem", "slider", "tab", "treeitem",
  "switch", "searchbox", "spinbutton", "menuitemcheckbox", "menuitemradio",
]);

export interface SnapshotNode {
  role: string;
  name: string;
  ref?: string;
  children: SnapshotNode[];
}

export interface SnapshotResult {
  tree: SnapshotNode;
  elements: Array<{ ref: string; role: string; name: string }>;
}

function parseAriaSnapshot(text: string): SnapshotNode[] {
  const lines = text.split("\n").filter(l => l.trim());
  const root: SnapshotNode[] = [];
  const stack: Array<{ indent: number; node: SnapshotNode }> = [];

  for (const line of lines) {
    const indent = line.search(/\S/);
    const content = line.trim();
    const match = content.match(/^-\s+(\w+)\s+"([^"]+)"/);

    if (!match) continue;

    const node: SnapshotNode = { role: match[1], name: match[2], children: [] };

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
    }

    stack.push({ indent, node });
  }

  return root;
}

function assignRefs(
  nodes: SnapshotNode[],
  counter: { current: number },
  elements: Array<{ ref: string; role: string; name: string }>,
): void {
  for (const node of nodes) {
    if (INTERACTIVE_ROLES.has(node.role)) {
      const ref = `@e${counter.current++}`;
      node.ref = ref;
      elements.push({ ref, role: node.role, name: node.name });
    }
    if (node.children.length > 0) {
      assignRefs(node.children, counter, elements);
    }
  }
}

function formatTree(nodes: SnapshotNode[], indent = 0): string {
  let result = "";
  for (const node of nodes) {
    const prefix = "  ".repeat(indent);
    const ref = node.ref ? ` [${node.ref}]` : "";
    result += `${prefix}- ${node.role} "${node.name}"${ref}\n`;
    if (node.children.length > 0) {
      result += formatTree(node.children, indent + 1);
    }
  }
  return result;
}

export async function takeSnapshot(page: Page): Promise<string> {
  const raw = await page.locator(":scope").ariaSnapshot();
  const parsed = parseAriaSnapshot(raw);
  const elements: Array<{ ref: string; role: string; name: string }> = [];
  const counter = { current: 1 };

  for (const tree of parsed) {
    assignRefs([tree], counter, elements);
  }

  const treeOutput = parsed.map(t => formatTree([t])).join("");

  if (elements.length === 0) {
    return `[Page snapshot]\n${treeOutput}\n(No interactive elements found)`;
  }

  const elementList = elements.map(e => `  ${e.ref}: ${e.role} "${e.name}"`).join("\n");

  return `[Page snapshot]\n${treeOutput}\n[Interactive elements]\n${elementList}`;
}
