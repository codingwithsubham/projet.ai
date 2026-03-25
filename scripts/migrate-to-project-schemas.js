/**
 * Migration Script: Shared Table to Schema-Per-Project
 * 
 * This script migrates embeddings data from the legacy shared table (aidlc_embeddings)
 * to project-specific schemas (project_{id}.embeddings).
 * 
 * Usage:
 *   node scripts/migrate-to-project-schemas.js [options]
 * 
 * Options:
 *   --dry-run     Preview migration without making changes
 *   --project-id  Migrate specific project only
 *   --cleanup     Remove migrated data from legacy table after verification
 *   --verify      Verify migration counts match
 * 
 * Example:
 *   node scripts/migrate-to-project-schemas.js --dry-run
 *   node scripts/migrate-to-project-schemas.js --project-id 65f1a2b3c4d5e6f7g8h9i0j1
 *   node scripts/migrate-to-project-schemas.js --verify
 */

require("dotenv").config();

const { getPool, closePgVector } = require("../config/pgvector");
const { 
  migrateProjectData, 
  getProjectStats, 
  listProjectSchemas,
  ensureProjectSchema,
  getSchemaName,
} = require("../services/schemaManager.service");

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const doCleanup = args.includes("--cleanup");
const doVerify = args.includes("--verify");
const projectIdArg = args.find(arg => arg.startsWith("--project-id="))?.split("=")[1] 
  || (args.indexOf("--project-id") >= 0 ? args[args.indexOf("--project-id") + 1] : null);

const LEGACY_TABLE = "aidlc_embeddings";

/**
 * Get all unique project IDs from the legacy table
 */
async function getLegacyProjectIds(pool) {
  const result = await pool.query(`
    SELECT DISTINCT metadata->>'projectId' as project_id
    FROM "${LEGACY_TABLE}"
    WHERE metadata->>'projectId' IS NOT NULL
    ORDER BY project_id
  `);
  
  return result.rows.map(row => row.project_id).filter(Boolean);
}

/**
 * Get document count for a project in the legacy table
 */
async function getLegacyProjectCount(pool, projectId) {
  const result = await pool.query(`
    SELECT COUNT(*) as count
    FROM "${LEGACY_TABLE}"
    WHERE metadata->>'projectId' = $1
  `, [projectId]);
  
  return parseInt(result.rows[0]?.count || 0);
}

/**
 * Delete migrated data from legacy table
 */
async function cleanupLegacyData(pool, projectId) {
  const result = await pool.query(`
    DELETE FROM "${LEGACY_TABLE}"
    WHERE metadata->>'projectId' = $1
  `, [projectId]);
  
  return result.rowCount || 0;
}

/**
 * Main migration function
 */
async function migrate() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║     Schema-Per-Project Migration                             ║");
  console.log("║     Migrating from shared table to project schemas           ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
  
  if (isDryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made\n");
  }
  
  const pool = getPool();
  
  try {
    // Check if legacy table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      ) as exists
    `, [LEGACY_TABLE]);
    
    if (!tableCheck.rows[0]?.exists) {
      console.log(`⚠️ Legacy table "${LEGACY_TABLE}" does not exist.`);
      console.log("   This might be a fresh installation. No migration needed.\n");
      return;
    }
    
    // Get projects to migrate
    let projectIds;
    if (projectIdArg) {
      projectIds = [projectIdArg];
      console.log(`📌 Migrating specific project: ${projectIdArg}\n`);
    } else {
      projectIds = await getLegacyProjectIds(pool);
      console.log(`📊 Found ${projectIds.length} projects in legacy table\n`);
    }
    
    if (projectIds.length === 0) {
      console.log("✅ No projects to migrate.\n");
      return;
    }
    
    // Migration summary
    const summary = {
      total: projectIds.length,
      migrated: 0,
      skipped: 0,
      failed: 0,
      totalDocs: 0,
      cleanedUp: 0,
    };
    
    // Process each project
    for (const projectId of projectIds) {
      const legacyCount = await getLegacyProjectCount(pool, projectId);
      const schemaName = getSchemaName(projectId);
      
      console.log(`\n┌─────────────────────────────────────────────────────────┐`);
      console.log(`│ Project: ${projectId}`);
      console.log(`│ Schema:  ${schemaName}`);
      console.log(`│ Documents in legacy table: ${legacyCount}`);
      console.log(`└─────────────────────────────────────────────────────────┘`);
      
      if (legacyCount === 0) {
        console.log("   ⏭️ Skipping - no documents in legacy table");
        summary.skipped++;
        continue;
      }
      
      if (isDryRun) {
        console.log("   🔍 Would migrate", legacyCount, "documents");
        summary.migrated++;
        summary.totalDocs += legacyCount;
        continue;
      }
      
      try {
        // Migrate data
        const result = await migrateProjectData(projectId, LEGACY_TABLE);
        
        if (result.migrated > 0) {
          console.log(`   ✅ Migrated ${result.migrated} documents`);
          summary.migrated++;
          summary.totalDocs += result.migrated;
          
          // Verify counts match
          if (doVerify) {
            const newStats = await getProjectStats(projectId);
            if (newStats.count === legacyCount) {
              console.log(`   ✓ Verified: counts match (${newStats.count})`);
            } else {
              console.log(`   ⚠️ Warning: count mismatch (legacy: ${legacyCount}, new: ${newStats.count})`);
            }
          }
          
          // Cleanup legacy data if requested
          if (doCleanup) {
            const deleted = await cleanupLegacyData(pool, projectId);
            console.log(`   🗑️ Cleaned up ${deleted} legacy records`);
            summary.cleanedUp += deleted;
          }
        } else if (result.skipped > 0) {
          console.log(`   ⏭️ Skipped - target table already has ${result.skipped} records`);
          summary.skipped++;
        }
      } catch (err) {
        console.log(`   ❌ Failed: ${err.message}`);
        summary.failed++;
      }
    }
    
    // Print summary
    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║                    MIGRATION SUMMARY                         ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");
    console.log(`   Total projects:     ${summary.total}`);
    console.log(`   Migrated:           ${summary.migrated}`);
    console.log(`   Skipped:            ${summary.skipped}`);
    console.log(`   Failed:             ${summary.failed}`);
    console.log(`   Total documents:    ${summary.totalDocs}`);
    if (doCleanup) {
      console.log(`   Cleaned up:         ${summary.cleanedUp} legacy records`);
    }
    console.log("");
    
    if (isDryRun) {
      console.log("💡 This was a dry run. Run without --dry-run to perform migration.\n");
    } else if (!doCleanup && summary.migrated > 0) {
      console.log("💡 Legacy data preserved. Run with --cleanup to remove after verification.\n");
    }
    
    // Show existing project schemas
    if (!isDryRun) {
      const schemas = await listProjectSchemas();
      if (schemas.length > 0) {
        console.log("📁 Project schemas in database:");
        for (const schema of schemas) {
          const stats = await getProjectStats(schema.projectId);
          console.log(`   ${schema.schemaName}: ${stats.count} docs, ${stats.schemaSize}`);
        }
        console.log("");
      }
    }
    
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await closePgVector();
  }
}

// Run migration
migrate().catch(console.error);
