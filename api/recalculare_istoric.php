<?php
// =============================================================================
// PIM Iași - Script de Recalculare și Aducere la Zi a Istoricului de Tonere
// SEDII VIZATE: Tudor (office = 3) și UMF 2 (office = 6)
// Interval analizat: 1 iulie 2026 - 13 octombrie 2026 (prezent)
// =============================================================================

ini_set('display_errors', '1');
error_reporting(E_ALL);

$isCli = (php_sapi_name() === 'cli');

if (!$isCli) {
    header('Content-Type: text/html; charset=utf-8');
}

require_once __DIR__ . '/config.php';

$secret = defined('DEPLOY_SECRET') ? DEPLOY_SECRET : 'pimro1_anasoft_deploy_2026';
$providedSecret = $isCli ? $secret : ($_GET['secret'] ?? $_POST['secret'] ?? '');

$db = getDBConnection();
if (!$db) {
    die("EROARE CRITICĂ: Nu s-a putut stabili conexiunea la baza de date.\n");
}

// 1. Verificare Securitate (CLI, Secret Webhook sau Sesiune Administrator)
if (!$isCli && (!defined('DEPLOY_SECRET') || !hash_equals(DEPLOY_SECRET, (string)$providedSecret))) {
    $authUser = getAuthenticatedUser($db);
    if (!$authUser || ($authUser['role'] ?? '') !== 'admin') {
        http_response_code(403);
        die("EROARE 403: Acces neautorizat. Doar administratorii sau scriptul securizat pot executa acest script.\n");
    }
}

// 2. Parametri de rulare
// mode=dry-run (implicit) sau mode=run (execuție cu salvare în baza de date)
$mode = $isCli ? ($argv[1] ?? 'dry-run') : ($_GET['mode'] ?? $_POST['mode'] ?? 'dry-run');
$isExecute = ($mode === 'run' || $mode === 'execute');
$format = $isCli ? 'cli' : ($_GET['format'] ?? 'html');

// 3. Informații Mediu
$host = $_SERVER['HTTP_HOST'] ?? 'CLI / Localhost';
$isPortal = (stristr($host, 'portal.pim.ro') !== false);
$envName = $isPortal ? 'PORTAL (PRODUCȚIE)' : 'DEV (DEZVOLTARE)';

// PASUL 1: BACKUP AUTOMAT (Dacă modul este RUN)
$backupLog = [];
if ($isExecute) {
    try {
        // Tabela reală în aplicație este istoric_schimbari.
        // Creăm backup pe ambele denumiri pentru compatibilitate totală conform cerinței:
        // CREATE TABLE IF NOT EXISTS schimbari_toner_backup AS SELECT * FROM ...
        $db->exec("CREATE TABLE IF NOT EXISTS `schimbari_toner_backup` AS SELECT * FROM `istoric_schimbari`");
        $backupLog[] = "Backup 'schimbari_toner_backup' creat/verificat cu succes.";

        $db->exec("CREATE TABLE IF NOT EXISTS `istoric_schimbari_backup` AS SELECT * FROM `istoric_schimbari`");
        $backupLog[] = "Backup 'istoric_schimbari_backup' creat/verificat cu succes.";

        // Creăm și un view schimbari_toner dacă nu există, pentru compatibilitate
        $db->exec("CREATE OR REPLACE VIEW `schimbari_toner` AS 
            SELECT 
                id_istoric_schimbare AS id,
                id_aparat,
                id_toner,
                contor,
                data_schimbare,
                id_user,
                copii_realizate AS nr_copii,
                consum_referinta,
                procent_realizat AS procent,
                nume_operator
            FROM `istoric_schimbari`");
        $backupLog[] = "View 'schimbari_toner' sincronizat cu succes.";
    } catch (Throwable $e) {
        die("EROARE la crearea backup-ului automat: " . $e->getMessage() . "\n");
    }
}

// PASUL 2: LOGICA DE EXECUȚIE A RECALCULĂRII
// 1. Selectează toate combinațiile unice de (aparat, tip_toner) existente pentru sediile Tudor și UMF 2
$sqlCombos = "
    SELECT DISTINCT 
           i.id_aparat, 
           a.nume_aparat, 
           a.office, 
           COALESCE(s.nume_sediu, CASE WHEN a.office = 3 THEN 'Tudor' WHEN a.office = 6 THEN 'UMF 2' ELSE 'Nedefinit' END) AS nume_sediu,
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
    ORDER BY a.office ASC, a.nume_aparat ASC, denumire_tip ASC
";
$combos = $db->query($sqlCombos)->fetchAll(PDO::FETCH_ASSOC);

$updatedTudor = 0;
$updatedUmf2 = 0;
$anomalii = [];
$allRecalculatedRows = [];

if ($isExecute) {
    $db->beginTransaction();
}

try {
    $stmtUpdate = $isExecute ? $db->prepare("
        UPDATE istoric_schimbari 
        SET copii_realizate = :nr_copii, 
            procent_realizat = :procent
        WHERE id_istoric_schimbare = :id
    ") : null;

    foreach ($combos as $combo) {
        $idAparat = (int)$combo['id_aparat'];
        $idTipToner = (int)$combo['id_tip_toner'];
        $numeAparat = $combo['nume_aparat'];
        $office = (int)$combo['office'];
        $sediu = $combo['nume_sediu'];
        $tipToner = $combo['denumire_tip'];

        // a. Caută dacă există un index istoric în baza veche/tabela de referință inițială pentru acest aparat și tip_toner
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
        $sursaIndexAnterior = 'prima_inregistrare_absoluta';

        if ($prevRow && (int)$prevRow['contor'] > 0) {
            $indexAnterior = (int)$prevRow['contor'];
            $sursaIndexAnterior = 'istoric_inainte_de_iulie';
        } else {
            // Fallback: contor_initial din tabela aparate
            $stmtCi = $db->prepare("SELECT contor_initial FROM aparate WHERE id_aparat = :aparat LIMIT 1");
            $stmtCi->execute([':aparat' => $idAparat]);
            $ciRow = $stmtCi->fetch(PDO::FETCH_ASSOC);
            if ($ciRow && (int)$ciRow['contor_initial'] > 0) {
                $indexAnterior = (int)$ciRow['contor_initial'];
                $sursaIndexAnterior = 'contor_initial_aparat';
            }
        }

        // b. Extrage toate înregistrările din tabela nouă filtrând strict după acel aparat și acel tip de toner,
        // începând cu data de 1 iulie 2026 până în prezent (13 octombrie 2026)
        $stmtRows = $db->prepare("
            SELECT i.id_istoric_schimbare, i.id_aparat, i.id_toner, i.contor, i.data_schimbare,
                   i.copii_realizate AS vechi_nr_copii, 
                   i.consum_referinta AS vechi_consum_ref, 
                   i.procent_realizat AS vechi_procent,
                   COALESCE(tt.consum_referinta, i.consum_referinta, 105000) AS ref_catalog
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
        $rows = $stmtRows->fetchAll(PDO::FETCH_ASSOC);

        // c. Parcurge fiecare rând găsit în această listă
        foreach ($rows as $r) {
            $id = (int)$r['id_istoric_schimbare'];
            $contorActual = (int)$r['contor'];
            $consumRef = (int)$r['ref_catalog'] > 0 ? (int)$r['ref_catalog'] : (int)$r['vechi_consum_ref'];
            if ($consumRef <= 0) $consumRef = 105000;

            $indexReferintaCalcul = $indexAnterior;
            $esteAnomalie = false;

            // Calcul NR_COPII:
            // Dacă $index_anterior există și este > 0: nr_copii_corect = contor_actual - $index_anterior
            // Altfel (dacă e prima înregistrare absolută): nr_copii_corect = 0
            if ($indexAnterior > 0) {
                $nrCopiiCorect = $contorActual - $indexAnterior;
            } else {
                $nrCopiiCorect = 0;
            }

            // Protecție la anomalii: Dacă nr_copii_corect < 0
            if ($nrCopiiCorect < 0) {
                $esteAnomalie = true;
                $anomalii[] = [
                    'id' => $id,
                    'sediu' => $sediu,
                    'aparat' => $numeAparat,
                    'tip_toner' => $tipToner,
                    'contor_actual' => $contorActual,
                    'index_anterior' => $indexAnterior,
                    'diferenta_negativa' => $nrCopiiCorect,
                    'data_schimbare' => $r['data_schimbare']
                ];
                $nrCopiiCorect = 0;
            }

            // Calcul Procent (cu protecție la împărțire la zero):
            if ($consumRef > 0) {
                $procentCorect = round(($nrCopiiCorect / $consumRef) * 100, 2);
            } else {
                $procentCorect = 0.00;
            }

            // Execută update-ul pe rândul curent
            if ($isExecute && $stmtUpdate) {
                $stmtUpdate->execute([
                    ':nr_copii' => $nrCopiiCorect,
                    ':procent' => $procentCorect,
                    ':id' => $id
                ]);
            }

            if ($office === 3 || $sediu === 'Tudor') {
                $updatedTudor++;
            } elseif ($office === 6 || $sediu === 'UMF 2') {
                $updatedUmf2++;
            }

            $allRecalculatedRows[] = [
                'id' => $id,
                'sediu' => $sediu,
                'aparat' => $numeAparat,
                'tip_toner' => $tipToner,
                'data_schimbare' => $r['data_schimbare'],
                'index_anterior' => $indexReferintaCalcul,
                'contor_actual' => $contorActual,
                'consum_referinta' => $consumRef,
                'vechi_nr_copii' => (int)$r['vechi_nr_copii'],
                'nr_copii_corect' => $nrCopiiCorect,
                'vechi_procent' => (float)$r['vechi_procent'],
                'procent_corect' => $procentCorect,
                'este_anomalie' => $esteAnomalie,
                'sursa_init' => $sursaIndexAnterior
            ];

            // Actualizează referința pentru următorul rând din această culoare pe acest aparat
            $indexAnterior = $contorActual;
        }
    }

    if ($isExecute) {
        $db->commit();
    }
} catch (Throwable $e) {
    if ($isExecute && $db->inTransaction()) {
        $db->rollBack();
    }
    die("EROARE LA EXECUȚIE: " . $e->getMessage() . "\n");
}

$totalUpdated = $updatedTudor + $updatedUmf2;

// Sortăm toate rândurile recalculate pentru afișarea primelor 10
// Ordonare cronologică sau după ID
usort($allRecalculatedRows, function($a, $b) {
    return strcmp($a['data_schimbare'], $b['data_schimbare']);
});
$primele10 = array_slice($allRecalculatedRows, 0, 10);

if ($format === 'json') {
    echo json_encode([
        'success' => true,
        'environment' => $envName,
        'mode' => $isExecute ? 'EXECUTED (Bază de date actualizată)' : 'DRY-RUN (Simulare)',
        'backup_log' => $backupLog,
        'summary' => [
            'total_tudor' => $updatedTudor,
            'total_umf2' => $updatedUmf2,
            'total_actualizate' => $totalUpdated,
            'anomalii_detectate' => count($anomalii)
        ],
        'anomalii' => $anomalii,
        'primele_10_inregistrari' => $primele10
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit();
}

// Formatare CLI sau HTML
if ($isCli) {
    echo "========================================================================\n";
    echo "RAPORT RECALCULARE ISTORIC TONERE (TUDOR & UMF 2)\n";
    echo "Mediu: " . $envName . "\n";
    echo "Mod execuție: " . ($isExecute ? "EXECUTED (Salvat în DB)" : "DRY-RUN (Simulare fără salvare)") . "\n";
    echo "========================================================================\n\n";

    if (!empty($backupLog)) {
        echo "BACKUP:\n - " . implode("\n - ", $backupLog) . "\n\n";
    }

    echo "SUMAR RECALCULARE:\n";
    echo " • Rânduri actualizate în sediul Tudor: " . $updatedTudor . "\n";
    echo " • Rânduri actualizate în sediul UMF 2: " . $updatedUmf2 . "\n";
    echo " • Total rânduri procesate: " . $totalUpdated . "\n";
    echo " • Anomalii detectate (contor < index_anterior): " . count($anomalii) . "\n\n";

    if (!empty($anomalii)) {
        echo "LISTA ANOMALII:\n";
        foreach ($anomalii as $anom) {
            echo " [ANOMALIE] ID: {$anom['id']} | {$anom['sediu']} - {$anom['aparat']} | Toner: {$anom['tip_toner']} | Contor: {$anom['contor_actual']} < Index Ant: {$anom['index_anterior']} | Data: {$anom['data_schimbare']}\n";
        }
        echo "\n";
    }

    echo "PRIMELE 10 ÎNREGISTRĂRI RECALCULATE:\n";
    printf("%-6s | %-8s | %-15s | %-10s | %-19s | %-10s | %-10s | %-12s | %-10s\n",
        "ID", "Sediu", "Aparat", "Tip Toner", "Data", "Index Ant.", "Contor Act.", "NR COPII", "PROCENT");
    echo str_repeat("-", 115) . "\n";
    foreach ($primele10 as $r) {
        printf("%-6d | %-8s | %-15s | %-10s | %-19s | %-10d | %-10d | %-12d | %-10s\n",
            $r['id'], $r['sediu'], $r['aparat'], $r['tip_toner'], $r['data_schimbare'],
            $r['index_anterior'], $r['contor_actual'], $r['nr_copii_corect'], $r['procent_corect'] . '%'
        );
    }
    echo "\n";
} else {
    // Afișare interfață HTML modernă, responsive
?>
<!DOCTYPE html>
<html lang="ro">
<head>
    <meta charset="UTF-8">
    <title>Recalculare Istoric Tonere - Tudor & UMF 2</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
        .container { max-width: 1200px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 28px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        h1 { margin-top: 0; color: #38bdf8; font-size: 24px; border-bottom: 2px solid #334155; padding-bottom: 12px; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 13px; font-weight: 600; text-transform: uppercase; margin-right: 8px; }
        .badge-dev { background: #0284c7; color: white; }
        .badge-dry { background: #eab308; color: #713f12; }
        .badge-run { background: #16a34a; color: white; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin: 24px 0; }
        .stat-card { background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 18px; }
        .stat-val { font-size: 28px; font-weight: 700; color: #38bdf8; margin-top: 4px; }
        .stat-label { font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
        th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #334155; }
        th { background: #0f172a; color: #94a3b8; font-weight: 600; font-size: 12px; text-transform: uppercase; }
        tr:hover { background: rgba(56, 189, 248, 0.05); }
        .diff-tag { font-size: 11px; color: #94a3b8; display: block; }
        .diff-chg { color: #4ade80; font-weight: 600; }
        .btn { display: inline-block; padding: 10px 20px; border-radius: 8px; font-weight: 600; text-decoration: none; cursor: pointer; border: none; margin-top: 16px; }
        .btn-run { background: #22c55e; color: #022c22; }
        .btn-run:hover { background: #16a34a; }
        .alert-box { background: rgba(22, 163, 74, 0.15); border: 1px solid #16a34a; color: #86efac; padding: 14px 18px; border-radius: 8px; margin-bottom: 20px; }
    </style>
</head>
<body>
<div class="container">
    <h1>
        Script de Recalculare Istoric Tonere
        <span class="badge badge-dev"><?= htmlspecialchars($envName) ?></span>
        <span class="badge <?= $isExecute ? 'badge-run' : 'badge-dry' ?>"><?= $isExecute ? 'EXECUTAT (ACTUALIZAT)' : 'SIMULARE (DRY-RUN)' ?></span>
    </h1>

    <?php if ($isExecute): ?>
        <div class="alert-box">
            ✔ <strong>Actualizarea a fost executată cu succes pe baza de date DEV!</strong> Backup-ul automat a fost salvat în tabela <code>schimbari_toner_backup</code>.
        </div>
    <?php else: ?>
        <p style="color: #cbd5e1;">Acesta este un <strong>DRY-RUN (Simulare)</strong>. Nicio modificare nu a fost scrisă în baza de date.</p>
    <?php endif; ?>

    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-label">Sediul Tudor</div>
            <div class="stat-val"><?= $updatedTudor ?> rânduri</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Sediul UMF 2</div>
            <div class="stat-val"><?= $updatedUmf2 ?> rânduri</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Total Procesate</div>
            <div class="stat-val"><?= $totalUpdated ?> rânduri</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Anomalii Detectate</div>
            <div class="stat-val" style="color: <?= count($anomalii) > 0 ? '#f87171' : '#4ade80' ?>"><?= count($anomalii) ?></div>
        </div>
    </div>

    <h3>Primele 10 Înregistrări Recalculate (Ordonate Cronologic)</h3>
    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Sediu</th>
                <th>Aparat</th>
                <th>Tip Toner</th>
                <th>Data</th>
                <th>Index Anterior</th>
                <th>Contor Actual</th>
                <th>NR COPII (Calculat)</th>
                <th>PROCENT</th>
            </tr>
        </thead>
        <tbody>
            <?php foreach ($primele10 as $r): ?>
                <tr>
                    <td><strong>#<?= $r['id'] ?></strong></td>
                    <td><?= htmlspecialchars($r['sediu']) ?></td>
                    <td><strong><?= htmlspecialchars($r['aparat']) ?></strong></td>
                    <td><span style="color: #38bdf8; font-weight: 600;"><?= htmlspecialchars($r['tip_toner']) ?></span></td>
                    <td style="color: #94a3b8;"><?= htmlspecialchars($r['data_schimbare']) ?></td>
                    <td><?= number_format($r['index_anterior'], 0, ',', '.') ?></td>
                    <td><strong><?= number_format($r['contor_actual'], 0, ',', '.') ?></strong></td>
                    <td>
                        <span class="diff-chg"><?= number_format($r['nr_copii_corect'], 0, ',', '.') ?></span>
                        <?php if ($r['vechi_nr_copii'] !== $r['nr_copii_corect']): ?>
                            <span class="diff-tag">vechi: <?= number_format($r['vechi_nr_copii'], 0, ',', '.') ?></span>
                        <?php endif; ?>
                    </td>
                    <td>
                        <span class="diff-chg"><?= $r['procent_corect'] ?>%</span>
                        <?php if (abs($r['vechi_procent'] - $r['procent_corect']) > 0.01): ?>
                            <span class="diff-tag">vechi: <?= $r['vechi_procent'] ?>%</span>
                        <?php endif; ?>
                    </td>
                </tr>
            <?php endforeach; ?>
        </tbody>
    </table>

    <?php if (!$isExecute): ?>
        <form method="POST" action="recalculare_istoric.php?mode=run&secret=<?= htmlspecialchars($secret) ?>" style="margin-top: 24px;">
            <input type="hidden" name="secret" value="<?= htmlspecialchars($secret) ?>">
            <input type="hidden" name="mode" value="run">
            <button type="submit" class="btn btn-run" onclick="return confirm('Ești sigur că vrei să execuți recalcularea și aducerea la zi pe baza de date DEV? Se va efectua backup automat înainte de modificare.');">
                🚀 Execută Recalcularea în Baza de Date (DEV)
            </button>
        </form>
    <?php endif; ?>
</div>
</body>
</html>
<?php
}
?>
