-- PobiNotes Database Repair & Familiarity Migration Script
-- This script backfills familiarity_id, user_id, and subject_id for all subjects in Cloudflare D1 / SQLite

-- 1. Backfill user_id from chapters & subjects if missing
UPDATE mistakes
SET user_id = (
  SELECT s.user_id 
  FROM chapters c 
  JOIN subjects s ON c.subject_id = s.id 
  WHERE c.id = mistakes.chapter_id
)
WHERE user_id IS NULL AND chapter_id IS NOT NULL;

-- 2. Backfill subject_id from chapters if missing
UPDATE mistakes
SET subject_id = (
  SELECT c.subject_id 
  FROM chapters c 
  WHERE c.id = mistakes.chapter_id
)
WHERE subject_id IS NULL AND chapter_id IS NOT NULL;

-- 3. Backfill familiarity_id for all subjects from data JSON content
UPDATE mistakes
SET familiarity_id = (
  SELECT c.id FROM categories c
  WHERE c.user_id = mistakes.user_id
    AND c.dimension = 'familiarity'
    AND (
      (c.name = '順' AND (mistakes.data LIKE '%"順"%' OR mistakes.data LIKE '%"會"%')) OR
      (c.name = '卡' AND mistakes.data LIKE '%"卡"%') OR
      (c.name = '不會' AND mistakes.data LIKE '%"不會"%') OR
      (c.name = '誤解' AND mistakes.data LIKE '%"誤解"%')
    )
  LIMIT 1
)
WHERE familiarity_id IS NULL
  AND (
    data LIKE '%"順"%' OR
    data LIKE '%"會"%' OR
    data LIKE '%"卡"%' OR
    data LIKE '%"不會"%' OR
    data LIKE '%"誤解"%'
  );
