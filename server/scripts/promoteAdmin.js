import { pool } from '../db.js';

const username = process.argv[2]?.trim().toLowerCase();

if (!username) {
    console.error('Uso: node --env-file=.env server/scripts/promoteAdmin.js <username>');
    process.exit(1);
}

const run = async () => {
    const result = await pool.query(
        `UPDATE users
         SET role = 'admin', updated_at = NOW()
         WHERE LOWER(username) = $1
         RETURNING id, username, role`,
        [username]
    );

    if (result.rowCount === 0) {
        console.error(`Usuario nao encontrado: ${username}`);
        process.exit(1);
    }

    console.log(`Usuario promovido: ${result.rows[0].username} (${result.rows[0].role})`);
    await pool.end();
};

run().catch(async (error) => {
    console.error('Falha ao promover admin', error);
    await pool.end();
    process.exit(1);
});
