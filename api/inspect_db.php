<?php
require_once __DIR__ . '/config.php';

$secret = defined('DEPLOY_SECRET') ? DEPLOY_SECRET : 'pimro1_anasoft_deploy_2026';
if (($_GET['secret'] ?? '') !== $secret) {
    http_response_code(403);
    die(json_encode(['status' => 'error', 'message' => 'Unauthorized']));
}

$db = getDBConnection();
if (!$db) {
    die(json_encode(['status' => 'error', 'message' => 'No DB connection']));
}

// 1. Tables in DB
$tables = $db->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);

// 2. Check if schimbari_toner or istoric_schimbari exists
$info = [];
foreach ($tables as $t) {
    if (in_array($t, ['schimbari_toner', 'istoric_schimbari', 'ink_history', 'aparate', 'tonere', 'tipuri_toner', 'sedii'])) {
        $cols = $db->query("SHOW COLUMNS FROM `$t`")->fetchAll(PDO::FETCH_ASSOC);
        $count = $db->query("SELECT COUNT(*) FROM `$t`")->fetchColumn();
        $info[$t] = [
            'count' => $count,
            'columns' => array_map(function($c) { return $c['Field'] . ' (' . $c['Type'] . ')'; }, $cols)
        ];
    }
}

// 3. Check sedii table
$sedii = [];
try {
    $sedii = $db->query("SELECT * FROM sedii")->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {}

// 4. Sample rows from aparate with Tudor and UMF
$aparate = [];
try {
    $aparate = $db->query("SELECT id_aparat, nume_aparat, office, contor_initial FROM aparate WHERE office IN (3, 6, 2) OR nume_aparat LIKE '%TUDOR%' OR nume_aparat LIKE '%UMF%' LIMIT 20")->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {}

echo json_encode([
    'all_tables' => $tables,
    'table_info' => $info,
    'sedii' => $sedii,
    'aparate_sample' => $aparate
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
