\set ON_ERROR_STOP on
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

-- Cohort of students who finished reading a topic and had seven full days to start.
WITH read_topics AS (
    SELECT t."Id", t."Title", p."UserId", max(p."CompletedAt") AS ready_at
    FROM "LessonProgress" p
    JOIN "Lessons" l ON l."Id" = p."LessonId" AND l."IsPublished"
    JOIN "Topics" t ON t."Id" = l."TopicId" AND t."IsPublished"
    JOIN "Courses" c ON c."Id" = t."CourseId" AND c."IsPublished"
    WHERE c."Slug" = :'course_slug'
    GROUP BY t."Id", t."Title", p."UserId"
    HAVING count(*) = (SELECT count(*) FROM "Lessons" l
                       WHERE l."TopicId" = t."Id" AND l."IsPublished")
)
SELECT "Title" AS topic, count(*) AS read_pairs,
       count(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM "Attempts" a
           WHERE a."UserId" = r."UserId" AND a."TopicId" = r."Id"
             AND a."BegunAt" >= r.ready_at AND a."BegunAt" < r.ready_at + interval '7 days'
       )) AS started_within_seven_days
FROM read_topics r
WHERE ready_at >= :'from'::timestamptz AND ready_at + interval '7 days' <= :'to'::timestamptz
GROUP BY "Id", "Title"
HAVING count(*) >= :'min_group'::integer
ORDER BY topic;

-- First actual start per student and topic. QTE preparations have no BegunAt.
WITH first_attempts AS (
    SELECT DISTINCT ON (a."UserId", a."TopicId")
        a."TopicId", a."AssessmentId", a."AssessmentVersionId", a."BegunAt", a."FinishedAt", a."Status"
    FROM "Attempts" a
    JOIN "Topics" t ON t."Id" = a."TopicId"
    JOIN "Courses" c ON c."Id" = t."CourseId"
    WHERE c."Slug" = :'course_slug' AND a."BegunAt" < :'to'::timestamptz
    ORDER BY a."UserId", a."TopicId", a."BegunAt", a."Id"
)
SELECT t."Title" AS topic, s."Mode" AS mode, v."VersionNumber" AS version,
       count(*) AS first_started,
       count(*) FILTER (WHERE f."FinishedAt" < :'to'::timestamptz) AS first_finished,
       count(*) FILTER (WHERE f."FinishedAt" < :'to'::timestamptz AND f."Status" = 'Passed') AS first_wins
FROM first_attempts f
JOIN "Topics" t ON t."Id" = f."TopicId"
JOIN "Assessments" s ON s."Id" = f."AssessmentId"
JOIN "AssessmentVersions" v ON v."Id" = f."AssessmentVersionId"
WHERE f."BegunAt" >= :'from'::timestamptz
GROUP BY t."Id", t."Title", s."Mode", v."VersionNumber"
HAVING count(*) >= :'min_group'::integer
ORDER BY topic, mode, version;

-- Outcomes and timeouts among attempts that finished in the reporting period.
SELECT t."Title" AS topic, s."Mode" AS mode, v."VersionNumber" AS version,
       count(*) AS finished_attempts,
       count(*) FILTER (WHERE a."Status" = 'Passed') AS wins,
       count(*) FILTER (WHERE a."Status" = 'Abandoned') AS abandoned,
       sum(q.presented) FILTER (WHERE s."Mode" = 'Boss') AS boss_questions_shown,
       sum(q.timed_out) FILTER (WHERE s."Mode" = 'Boss') AS boss_questions_timed_out,
       count(*) FILTER (WHERE s."Mode" = 'Crisis' AND a."FinishReason" = 'TimeExpired') AS crisis_timeouts
FROM "Attempts" a
JOIN "Topics" t ON t."Id" = a."TopicId"
JOIN "Courses" c ON c."Id" = t."CourseId"
JOIN "Assessments" s ON s."Id" = a."AssessmentId"
JOIN "AssessmentVersions" v ON v."Id" = a."AssessmentVersionId"
CROSS JOIN LATERAL (
    SELECT count(*) FILTER (WHERE aq."PresentedAt" IS NOT NULL) AS presented,
           count(*) FILTER (WHERE aq."Status" = 'TimedOut') AS timed_out
    FROM "AttemptQuestions" aq WHERE aq."AttemptId" = a."Id"
) q
WHERE c."Slug" = :'course_slug' AND a."BegunAt" IS NOT NULL
  AND a."FinishedAt" >= :'from'::timestamptz AND a."FinishedAt" < :'to'::timestamptz
GROUP BY t."Id", t."Title", s."Mode", v."VersionNumber"
HAVING count(DISTINCT a."UserId") >= :'min_group'::integer
ORDER BY topic, mode, version;

WITH awards AS (
    SELECT l."TopicId", p."UserId", 'Lesson' AS reason, p."AwardedXp" AS xp, 0 AS coins
    FROM "LessonProgress" p
    JOIN "Lessons" l ON l."Id" = p."LessonId"
    WHERE p."CompletedAt" >= :'from'::timestamptz AND p."CompletedAt" < :'to'::timestamptz
    UNION ALL
    SELECT "TopicId", "UserId", "Reason", "XpAmount", "CoinsAmount"
    FROM "RewardGrants"
    WHERE "GrantedAt" >= :'from'::timestamptz AND "GrantedAt" < :'to'::timestamptz
)
SELECT t."Title" AS topic, a.reason, count(*) AS events, sum(a.xp) AS xp, sum(a.coins) AS coins
FROM awards a
JOIN "Topics" t ON t."Id" = a."TopicId"
JOIN "Courses" c ON c."Id" = t."CourseId"
WHERE c."Slug" = :'course_slug'
GROUP BY t."Id", t."Title", a.reason
HAVING count(DISTINCT a."UserId") >= :'min_group'::integer
ORDER BY topic, reason;

-- The wallet is shared across courses, so purchases are reported for the whole platform.
SELECT count(*) AS platform_purchases, sum("PricePaid") AS platform_coins_spent
FROM "SkinPurchases"
WHERE "CreatedAt" >= :'from'::timestamptz AND "CreatedAt" < :'to'::timestamptz
HAVING count(DISTINCT "UserId") >= :'min_group'::integer;

COMMIT;
