/**
 * @file scripts/check-confirmation-mode.mjs
 *
 * Pre-flight for migration 0007: aborts (exit 1) if any **active** session
 * still has `confirmationMode === 'EITHER'`. Run before applying the
 * migration in production.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/check-confirmation-mode.mjs
 */
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('DATABASE_URL is required');
	process.exit(2);
}

const sql = postgres(url, { max: 1 });
try {
	const rows = await sql`
		SELECT id, name, status
		FROM sessions
		WHERE status = 'ACTIVE' AND config->>'confirmationMode' = 'EITHER'
	`;
	if (rows.length > 0) {
		console.error(`✘ ${rows.length} active session(s) still on EITHER:`);
		for (const r of rows) console.error(`  - ${r.id}  ${r.name}`);
		process.exit(1);
	}
	const [legacy] = await sql`
		SELECT count(*)::int AS n
		FROM sessions
		WHERE config->>'confirmationMode' = 'EITHER'
	`;
	console.log(
		`✔ No active sessions on EITHER. (${legacy.n} closed sessions will be backfilled to PEERS by the migration.)`
	);
} finally {
	await sql.end({ timeout: 1 });
}
