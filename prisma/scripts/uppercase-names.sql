BEGIN;

UPDATE specialties
SET name = UPPER(TRIM(name))
WHERE name IS NOT NULL AND name <> UPPER(TRIM(name));

UPDATE categories
SET name = UPPER(TRIM(name))
WHERE name IS NOT NULL AND name <> UPPER(TRIM(name));

UPDATE sectors
SET name = UPPER(TRIM(name))
WHERE name IS NOT NULL AND name <> UPPER(TRIM(name));

UPDATE storage_locations
SET name = UPPER(TRIM(name))
WHERE name IS NOT NULL AND name <> UPPER(TRIM(name));

UPDATE products
SET name = UPPER(TRIM(name))
WHERE name IS NOT NULL AND name <> UPPER(TRIM(name));

UPDATE appointments
SET client_name = UPPER(TRIM(client_name))
WHERE client_name IS NOT NULL AND client_name <> UPPER(TRIM(client_name));

COMMIT;
