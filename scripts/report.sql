SELECT 'total_reset_requests' AS metric, clicks AS value
FROM totals
WHERE scope = 'global';

SELECT 'requests_today_utc' AS metric, COALESCE(SUM(clicks), 0) AS value
FROM daily_regions
WHERE day = date('now');

SELECT country, clicks
FROM country_totals
ORDER BY clicks DESC
LIMIT 20;

SELECT country, region, clicks
FROM region_totals
ORDER BY clicks DESC
LIMIT 20;

SELECT day, SUM(clicks) AS clicks
FROM daily_regions
GROUP BY day
ORDER BY day DESC
LIMIT 30;
