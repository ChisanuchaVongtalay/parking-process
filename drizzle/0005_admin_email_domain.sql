DELETE FROM admin_sessions
WHERE account_id IN (
  SELECT id FROM admin_accounts
  WHERE lower(substr(email, instr(email, '@') + 1)) = 'landuan.mfu.ac.th'
);

UPDATE admin_accounts
SET email = substr(email, 1, instr(email, '@')) || 'lamduan.mfu.ac.th'
WHERE lower(substr(email, instr(email, '@') + 1)) = 'landuan.mfu.ac.th';
