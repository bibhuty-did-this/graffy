import pool from './pool.js';
import sql from 'sql-template-tag';

test.skip('scratch', async () => {
  const res = await pool.query(sql`SELECT ${{ foo: 43 }}`);
  console.log(res);
});