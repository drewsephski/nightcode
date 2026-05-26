import { ClientManager } from "./src/lib/mcp/client";

async function main() {
  console.log("=== Test: MCP Client Manager (with explicit config) ===");
  
  const client = new ClientManager();
  
  // Init with explicit config path
  console.log("\n1. init(/Users/drewsepeczi/night/nightcode.json)");
  
  // Log what env var looks like
  console.log(`   CONTEXT7_API_KEY set: ${!!process.env.CONTEXT7_API_KEY}`);
  
  // The issue is that the MCP servers (context7, ghGrep) require network access
  // and may fail gracefully. Let's just verify the config loads.
  const { loadConfig } = await import("./src/lib/mcp/config");
  const config = loadConfig("/Users/drewsepeczi/night/nightcode.json");
  console.log(`   Servers in config: ${Object.keys(config.mcp).length}`);
  for (const name of Object.keys(config.mcp)) {
    const server = config.mcp[name]!;
    console.log(`   ${name}: type=${server.type}, url=${server.url || server.command?.join(" ")}`);
  }
  
  await client.init("/Users/drewsepeczi/night/nightcode.json");
  
  // Check statuses after init
  console.log("\n2. Server statuses after init:");
  const statuses = client.getServerStatuses();
  for (const [name, status] of Object.entries(statuses)) {
    console.log(`   ${name}: ${status}`);
  }
  
  const tools = client.getToolDefs();
  console.log(`\n3. Tools discovered: ${tools.length}`);
  
  // Cleanup
  console.log("\n4. disconnect()");
  client.disconnect();
  
  console.log("\n=== MCP CLIENT TESTS COMPLETE ===");
}

main().catch(e => { console.error("FAIL:", e); process.exit(1); });
