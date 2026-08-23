BEGIN;

ALTER TABLE public.files
    ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE public.files
    ADD COLUMN IF NOT EXISTS size_bytes bigint;

UPDATE public.files AS files
SET user_id = folders.user_id::uuid
FROM public.folders AS folders
WHERE files.user_id IS NULL
  AND files.folder_id = folders.id
  AND folders.user_id IS NOT NULL
  AND folders.user_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

COMMIT;
