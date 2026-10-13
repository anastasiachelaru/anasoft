<?php
require_once __DIR__ . '/config.php';

ini_set('display_errors', '1');
error_reporting(E_ALL);

$secret = defined('DEPLOY_SECRET') ? DEPLOY_SECRET : 'pimro1_anasoft_deploy_2026';
if (($_GET['secret'] ?? '') !== $secret) {
    http_response_code(403);
    die(json_encode(['status' => 'error', 'message' => 'Unauthorized']));
}

try {
    $db = getDBConnection();
    if (!$db) {
        throw new Exception("Nu s-a putut conecta la baza de date.");
    }

// 1. Get all combinations of (id_aparat, id_tip_toner) for Tudor (office 3) and UMF 2 (office 6)
$stmtCombos = $db->query("
    SELECT DISTINCT 
           i.id_aparat, 
           a.nume_aparat, 
           a.office, 
           s.nume_sediu,
           COALESCE(t.id_tip_toner, i.id_toner) AS id_tip_toner,
           COALESCE(tt.denumire_tip, CONCAT('Toner #', i.id_toner)) AS denumire_tip
    FROM istoric_schimbari i
    JOIN aparate a ON i.id_aparat = a.id_aparat
    LEFT JOIN sedii s ON a.office = s.id_office
    LEFT JOIN tonere t ON i.id_toner = t.id_toner
    LEFT JOIN tipuri_toner tt ON COALESCE(t.id_tip_toner, i.id_toner) = tt.id_tip_toner
    WHERE (a.office IN (3, 6) OR s.nume_sediu IN ('Tudor', 'UMF 2'))
      AND i.data_schimbare >= '2026-07-01 00:00:00'
      AND i.data_schimbare <= '2026-10-13 23:59:59'
    ORDER BY a.office, a.nume_aparat, denumire_tip
");
$combos = $stmtCombos->fetchAll(PDO::FETCH_ASSOC);

// 2. For each combination, simulate the calculation
$results = [];
$anomalii = [];
$tudorCount = 0;
$umf2Count = 0;

foreach ($combos as $combo) {
    $idAparat = (int)$combo['id_aparat'];
    $idTipToner = (int)$combo['id_tip_toner'];
    $numeAparat = $combo['nume_aparat'];
    $office = (int)$combo['office'];
    $sediu = $combo['nume_sediu'];
    $tipToner = $combo['denumire_tip'];

    // a. Caută dacă există un index istoric în baza veche/tabela de referință inițială pentru acest aparat și tip_toner
    // Înainte de 2026-07-01
    $stmtPrev = $db->prepare("
        SELECT i.contor 
        FROM istoric_schimbari i
        LEFT JOIN tonere t ON i.id_toner = t.id_toner
        WHERE i.id_aparat = :aparat
          AND (t.id_tip_toner = :tip OR i.id_toner = :tip2)
          AND i.data_schimbare < '2026-07-01 00:00:00'
        ORDER BY i.data_schimbare DESC, i.id_istoric_schimbare DESC
        LIMIT 1
    ");
    $stmtPrev->execute([':aparat' => $idAparat, ':tip' => $idTipToner, ':tip2' => $idTipToner]);
    $prevRow = $stmtPrev->fetch(PDO::FETCH_ASSOC);

    $indexAnterior = 0;
    $sursaIndexAnterior = 'none';

    if ($prevRow && (int)$prevRow['contor'] > 0) {
        $indexAnterior = (int)$prevRow['contor'];
        $sursaIndexAnterior = 'istoric_inainte_de_iulie';
    } else {
        // Fallback: verificare contor_initial din aparate
        $stmtCi = $db->prepare("SELECT contor_initial FROM aparate WHERE id_aparat = :aparat");
        $stmtCi->execute([':aparat' => $idAparat]);
        $ciRow = $stmtCi->fetch(PDO::FETCH_ASSOC);
        if ($ciRow && (int)$ciRow['contor_initial'] > 0) {
            $indexAnterior = (int)$ciRow['contor_initial'];
            $sursaIndexAnterior = 'contor_initial_aparat';
        }
    }

    // b. Extrage toate înregistrările din tabela nouă filtrând strict după acel aparat și acel tip de toner
    // între 2026-07-01 și 2026-10-13 ordonate cronologic (data_schimbare ASC, id ASC)
    $stmtRows = $db->prepare("
        SELECT i.id_istoric_schimbare, i.id_aparat, i.id_toner, i.contor, i.data_schimbare,
               i.copii_realizate AS nr_copii_vechi, 
               i.consum_referinta, 
               i.procent_realizat AS procent_vechi,
               COALESCE(tt.consum_referinta, i.consum_referinta, 105000) as ref_actual
        FROM istoric_schimbari i
        LEFT JOIN tonere t ON i.id_toner = t.id_toner
        LEFT JOIN tipuri_toner tt ON COALESCE(t.id_tip_toner, i.id_toner) = tt.id_tip_toner
        WHERE i.id_aparat = :aparat
          AND (t.id_tip_toner = :tip OR i.id_toner = :tip2)
          AND i.data_schimbare >= '2026-07-01 00:00:00'
          AND i.data_schimbare <= '2026-10-13 23:59:59'
        ORDER BY i.data_schimbare ASC, i.id_istoric_schimbare ASC
    ");
    $stmtRows->execute([':aparat' => $idAparat, ':tip' => $idTipToner, ':tip2' => $idTipToner]);
    $records = $stmtRows->fetchAll(PDO::FETCH_ASSOC);

    $comboResults = [];

    // c. Parcurge fiecare rând
    foreach ($records as $row) {
        $id = (int)$row['id_istoric_schimbare'];
        $contorActual = (int)$row['contor'];
        $consumRef = (int)$row['ref_actual'] > 0 ? (int)$row['ref_actual'] : (int)$row['consum_referinta'];
        if ($consumRef <= 0) $consumRef = 105000;

        $indexRef = $indexAnterior;
        $isAnomaly = false;

        if ($indexAnterior > 0) {
            $nrCopiiCorect = $contorActual - $indexAnterior;
        } else {
            $nrCopiiCorect = 0;
        }

        // Protecție la anomalii
        if ($nrCopiiCorect < 0) {
            $isAnomaly = true;
            $anomalii[] = [
                'id' => $id,
                'aparat' => $numeAparat,
                'sediu' => $sediu,
                'tip_toner' => $tipToner,
                'contor_actual' => $contorActual,
                'index_anterior' => $indexAnterior,
                'diferenta_negativa' => $nrCopiiCorect,
                'data_schimbare' => $row['data_schimbare']
            ];
            $nrCopiiCorect = 0;
        }

        // Calcul procent
        if ($consumRef > 0) {
            $procentCorect = round(($nrCopiiCorect / $consumRef) * 100, 2);
        } else {
            $procentCorect = 0;
        }

        if ($office === 3 || $sediu === 'Tudor') {
            $tudorCount++;
        } elseif ($office === 6 || $sediu === 'UMF 2') {
            $umf2Count++;
        }

        $comboResults[] = [
            'id' => $id,
            'aparat' => $numeAparat,
            'office' => $office,
            'sediu' => $sediu,
            'tip_toner' => $tipToner,
            'data_schimbare' => $row['data_schimbare'],
            'index_anterior' => $indexRef,
            'contor_actual' => $contorActual,
            'consum_referinta' => $consumRef,
            'nr_copii_vechi' => (int)$row['nr_copii_vechi'],
            'nr_copii_corect' => $nrCopiiCorect,
            'procent_vechi' => (float)$row['procent_vechi'],
            'procent_corect' => $procentCorect,
            'is_anomaly' => $isAnomaly
        ];

        // Actualizează referința pentru următorul rând
        $indexAnterior = $contorActual;
    }

    $results[$numeAparat . ' | ' . $tipToner] = [
        'index_anterior_initial' => $combo['initial_ref'] ?? 0,
        'sursa_initiala' => $sursaIndexAnterior,
        'records' => $comboResults
    ];
}

    echo json_encode([
        'combos_count' => count($combos),
        'tudor_count' => $tudorCount,
        'umf2_count' => $umf2Count,
        'total_count' => $tudorCount + $umf2Count,
        'anomalies_count' => count($anomalii),
        'anomalies' => $anomalii,
        'results' => $results
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}
