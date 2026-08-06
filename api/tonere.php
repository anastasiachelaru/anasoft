<?php
require_once __DIR__ . '/config.php';

$db = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? $_POST['action'] ?? 'list';
$officeId = isset($_GET['office']) ? (int)$_GET['office'] : null;

$officesMap = [
    2 => 'UMF',
    3 => 'TUDOR',
    4 => 'TIPO',
    5 => 'SMÂRDAN',
    6 => 'UMF2',
    0 => 'COPOU'
];

if ($action === 'list') {
    if ($db) {
        $sql = "SELECT t.id_toner, t.id_tip_toner, t.office, t.stoc, t.toner_activ, 
                       tt.denumire_tip, tt.consum_referinta
                FROM tonere t
                JOIN tipuri_toner tt ON t.id_tip_toner = tt.id_tip_toner
                WHERE t.toner_activ = 1";
        
        $params = [];
        if ($officeId !== null) {
            $sql .= " AND t.office = :office";
            $params[':office'] = $officeId;
        }
        
        $sql .= " ORDER BY tt.denumire_tip ASC";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $tonere = $stmt->fetchAll();
        
        // Încarcă aparatele compatibile pentru fiecare toner
        foreach ($tonere as &$t) {
            $stmtApp = $db->prepare("SELECT a.id_aparat, a.nume_aparat, a.office 
                                     FROM tonere_aparate ta 
                                     JOIN aparate a ON ta.id_aparat = a.id_aparat 
                                     WHERE ta.id_toner = :id_toner AND a.aparat_activ = 1");
            $stmtApp->execute([':id_toner' => $t['id_toner']]);
            $t['aparate_compatibile'] = $stmtApp->fetchAll();
            $t['office_nume'] = $officesMap[$t['office']] ?? 'Necunoscut';
        }
        
        sendResponse(true, 'Lista de tonere încărcată cu succes.', $tonere);
    } else {
        // Data mock completă extrasă din pimcopyr_toner.sql pentru vizualizare directă
        $mockTonere = [
            ['id_toner' => 34, 'id_tip_toner' => 19, 'denumire_tip' => 'TN14 (Konica Minolta 1050/1200)', 'office' => 2, 'office_nume' => 'UMF', 'stoc' => 22, 'consum_referinta' => 105000, 'aparate_compatibile' => [['id_aparat' => 8, 'nume_aparat' => 'UMF-AN3'], ['id_aparat' => 9, 'nume_aparat' => 'UMF-AN2']]],
            ['id_toner' => 35, 'id_tip_toner' => 6, 'denumire_tip' => 'TN622C Cyan (Bizhub Press C1085/C1100)', 'office' => 2, 'office_nume' => 'UMF', 'stoc' => 6, 'consum_referinta' => 95000, 'aparate_compatibile' => [['id_aparat' => 14, 'nume_aparat' => 'UMF-C1100-1']]],
            ['id_toner' => 36, 'id_tip_toner' => 7, 'denumire_tip' => 'TN622M Magenta (Bizhub Press C1085/C1100)', 'office' => 2, 'office_nume' => 'UMF', 'stoc' => 5, 'consum_referinta' => 92000, 'aparate_compatibile' => [['id_aparat' => 14, 'nume_aparat' => 'UMF-C1100-1']]],
            ['id_toner' => 37, 'id_tip_toner' => 8, 'denumire_tip' => 'TN622Y Yellow (Bizhub Press C1085/C1100)', 'office' => 2, 'office_nume' => 'UMF', 'stoc' => 6, 'consum_referinta' => 104000, 'aparate_compatibile' => [['id_aparat' => 14, 'nume_aparat' => 'UMF-C1100-1']]],
            ['id_toner' => 38, 'id_tip_toner' => 9, 'denumire_tip' => 'TN622K Black (Bizhub Press C1085/C1100)', 'office' => 2, 'office_nume' => 'UMF', 'stoc' => 6, 'consum_referinta' => 88000, 'aparate_compatibile' => [['id_aparat' => 14, 'nume_aparat' => 'UMF-C1100-1']]],
            ['id_toner' => 43, 'id_tip_toner' => 14, 'denumire_tip' => 'TN321C Cyan (Bizhub C224e/C284e/C364e)', 'office' => 2, 'office_nume' => 'UMF', 'stoc' => 5, 'consum_referinta' => 25000, 'aparate_compatibile' => [['id_aparat' => 16, 'nume_aparat' => 'UMF-C364e']]],
            ['id_toner' => 82, 'id_tip_toner' => 19, 'denumire_tip' => 'TN14 Black (Smârdan Press 1250)', 'office' => 5, 'office_nume' => 'SMÂRDAN', 'stoc' => 7, 'consum_referinta' => 105000, 'aparate_compatibile' => [['id_aparat' => 27, 'nume_aparat' => 'SMARDAN-1250-1']]],
            ['id_toner' => 100, 'id_tip_toner' => 19, 'denumire_tip' => 'TN14 Black (Tudor Pro 1052)', 'office' => 3, 'office_nume' => 'TUDOR', 'stoc' => 9, 'consum_referinta' => 105000, 'aparate_compatibile' => [['id_aparat' => 20, 'nume_aparat' => 'TUDOR-T1']]],
            ['id_toner' => 114, 'id_tip_toner' => 42, 'denumire_tip' => 'TN17 Black (Tipografie 1250)', 'office' => 4, 'office_nume' => 'TIPO', 'stoc' => 4, 'consum_referinta' => 105000, 'aparate_compatibile' => [['id_aparat' => 48, 'nume_aparat' => 'TIPO-1250-3']]],
        ];
        
        if ($officeId !== null) {
            $mockTonere = array_values(array_filter($mockTonere, function($t) use ($officeId) {
                return $t['office'] === $officeId;
            }));
        }
        
        sendResponse(true, 'Lista mock încărcată.', $mockTonere);
    }
}
elseif ($action === 'aparate') {
    if ($db) {
        $sql = "SELECT id_aparat, nume_aparat, office, aparat_activ FROM aparate WHERE aparat_activ = 1";
        if ($officeId !== null) {
            $sql .= " AND office = " . (int)$officeId;
        }
        $sql .= " ORDER BY nume_aparat ASC";
        $stmt = $db->prepare($sql);
        $stmt->execute();
        sendResponse(true, 'Aparate încărcate.', $stmt->fetchAll());
    } else {
        $mockAparate = [
            ['id_aparat' => 8, 'nume_aparat' => 'UMF-AN3', 'office' => 2],
            ['id_aparat' => 9, 'nume_aparat' => 'UMF-AN2', 'office' => 2],
            ['id_aparat' => 14, 'nume_aparat' => 'UMF-C1100-1', 'office' => 2],
            ['id_aparat' => 16, 'nume_aparat' => 'UMF-C364e', 'office' => 2],
            ['id_aparat' => 20, 'nume_aparat' => 'TUDOR-T1', 'office' => 3],
            ['id_aparat' => 27, 'nume_aparat' => 'SMARDAN-1250-1', 'office' => 5],
            ['id_aparat' => 48, 'nume_aparat' => 'TIPO-1250-3', 'office' => 4],
        ];
        if ($officeId !== null) {
            $mockAparate = array_values(array_filter($mockAparate, function($a) use ($officeId) {
                return $a['office'] === $officeId;
            }));
        }
        sendResponse(true, 'Aparate mock încărcate.', $mockAparate);
    }
}
elseif ($action === 'add-stock') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $idToner = (int)($input['id_toner'] ?? 0);
    $cantitate = (int)($input['cantitate'] ?? 0);
    
    if ($idToner <= 0 || $cantitate <= 0) {
        sendResponse(false, 'Selectează un toner și introdu o cantitate validă.', null, 400);
    }
    
    if ($db) {
        $stmt = $db->prepare("UPDATE tonere SET stoc = stoc + :cantitate WHERE id_toner = :id");
        $stmt->execute([':cantitate' => $cantitate, ':id' => $idToner]);
        sendResponse(true, "Stocul a fost suplimentat cu +{$cantitate} bucăți.");
    } else {
        sendResponse(true, "Stocul a fost suplimentat cu +{$cantitate} bucăți (Demo).");
    }
}
