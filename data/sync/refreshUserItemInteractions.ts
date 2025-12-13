/**
 * Refresh User Item Interactions Materialized View
 *
 * Refreshes the user_item_interactions_mv materialized view concurrently.
 */

import { query } from "../db/index.js";
import { closePool } from "../db/index.js";

async function main() {
  console.log("🔄 Refreshing user_item_interactions_mv materialized view...\n");

  try {
    await query(
      "REFRESH MATERIALIZED VIEW CONCURRENTLY user_item_interactions_mv",
    );
    console.log("✅ Successfully refreshed user_item_interactions_mv\n");
  } catch (error) {
    console.error("❌ Error refreshing materialized view:", error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
