<?php
require_once __DIR__ . '/config.php';

$secret = defined('DEPLOY_SECRET') ? DEPLOY_SECRET : 'pimro1_anasoft_deploy_2026';
if (($_GET['secret'] ?? '') !== $secret) {
    http_response_code(403);
    die(json_encode(['status' => 'error', 'message' => 'Unauthorized']));
}

$db = getDBConnection();

// Check all aparate
$aparate = $db->query("SELECT id_aparat, nume_aparat, office, contor_initial FROM aparate ORDER BY id_aparat ASC")->fetchAll(PDO::FETCH_ASSOC);

// Check date range of istoric_schimbari
$dates = $db->query("SELECT MIN(data_schimbare) as min_date, MAX(data_schimbare) as max_date FROM istoric_schimbari")->fetch(PDO::FETCH_ASSOC);

// Check count of records between 2026-07-01 and 2026-10-13 per office/aparat
$stmtRecs = $db->query("
    SELECT a.office, 
           CASE 
             WHEN a.office = 3 OR a.nume_aparat LIKE '%TUDOR%' THEN 'Tudor'
             WHEN a.office = 6 OR a.office = 2 OR a.nume_aparat LIKE '%UMF%' THEN 'UMF'
             ELSE 'Other'
           END as sediu_dedus,
           COUNT(*) as cnt,
           MIN(s.data_schimbare) as min_dt,
           MAX(s.data_schimbare) as max_dt
    FROM istoric_schimbari s
    LEFT JOIN aparate a ON s.id_aparat = a.id_aparat
    WHERE s.data_schimbare >= '2026-07-01 00:00:00'
    GROUP BY a.office, sediu_dedus
");
$recsByOffice = $stmtRecs->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    'date_bounds' => $dates,
    'records_since_july_2026' => $recsByOffice,
    'all_aparate' => $aparate
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
