<?php
require_once __DIR__ . '/config.php';

$secret = defined('DEPLOY_SECRET') ? DEPLOY_SECRET : 'pimro1_anasoft_deploy_2026';
if (($_GET['secret'] ?? '') !== $secret) {
    http_response_code(403);
    die(json_encode(['status' => 'error', 'message' => 'Unauthorized']));
}

$db = getDBConnection();

// Let's inspect aparate for office 3 and office 6, and see if office 2 has anything labeled UMF 2
$stmt = $db->query("
    SELECT DISTINCT a.id_aparat, a.nume_aparat, a.office, s.nume_sediu, COUNT(i.id_istoric_schimbare) as nr_inregistrari,
           MIN(i.data_schimbare) as prima_inreg, MAX(i.data_schimbare) as ultima_inreg
    FROM aparate a
    LEFT JOIN sedii s ON a.office = s.id_office
    LEFT JOIN istoric_schimbari i ON a.id_aparat = i.id_aparat AND i.data_schimbare >= '2026-07-01 00:00:00'
    WHERE a.office IN (2, 3, 6) OR a.nume_aparat LIKE '%UMF%' OR a.nume_aparat LIKE '%TUDOR%'
    GROUP BY a.id_aparat, a.nume_aparat, a.office, s.nume_sediu
    HAVING nr_inregistrari > 0
    ORDER BY a.office, a.nume_aparat
");

$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Also let's inspect the actual records in Tudor (office 3) and UMF 2 (office 6)
$sampleRecs = $db->query("
    SELECT i.id_istoric_schimbare, i.id_aparat, a.nume_aparat, a.office, s.nume_sediu, 
           i.id_toner, t.id_tip_toner, tt.denumire_tip,
           i.contor, i.copii_realizate, i.consum_referinta, i.procent_realizat, i.data_schimbare
    FROM istoric_schimbari i
    JOIN aparate a ON i.id_aparat = a.id_aparat
    LEFT JOIN sedii s ON a.office = s.id_office
    LEFT JOIN tonere t ON i.id_toner = t.id_toner
    LEFT JOIN tipuri_toner tt ON t.id_tip_toner = tt.id_tip_toner
    WHERE i.data_schimbare >= '2026-07-01 00:00:00'
      AND (a.office IN (3, 6) OR s.nume_sediu IN ('Tudor', 'UMF 2'))
    ORDER BY a.office, i.id_aparat, tt.id_tip_toner, i.data_schimbare ASC
")->fetchAll(PDO::FETCH_ASSOC);

// Let's also check if there is any historical reference before 2026-07-01 for these aparate!
$historyBeforeJuly = $db->query("
    SELECT i.id_aparat, a.nume_aparat, a.office, t.id_tip_toner, tt.denumire_tip,
           MAX(i.data_schimbare) as last_date_before_july,
           SUBSTRING_INDEX(GROUP_CONCAT(i.contor ORDER BY i.data_schimbare DESC), ',', 1) as last_contor_before_july
    FROM istoric_schimbari i
    JOIN aparate a ON i.id_aparat = a.id_aparat
    LEFT JOIN tonere t ON i.id_toner = t.id_toner
    LEFT JOIN tipuri_toner tt ON t.id_tip_toner = tt.id_tip_toner
    WHERE i.data_schimbare < '2026-07-01 00:00:00'
      AND a.office IN (3, 6)
    GROUP BY i.id_aparat, a.nume_aparat, a.office, t.id_tip_toner, tt.denumire_tip
")->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    'active_aparate' => $rows,
    'history_before_july' => $historyBeforeJuly,
    'sample_recs_count' => count($sampleRecs),
    'sample_recs' => array_slice($sampleRecs, 0, 15)
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
