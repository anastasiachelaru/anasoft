<?php
require_once __DIR__ . '/config.php';

$db = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? $_POST['action'] ?? 'list';
$officeId = isset($_GET['office']) ? (int)$_GET['office'] : null;

$officesMap = [
    2 => 'Independenței',
    3 => 'TUDOR',
    4 => 'TIPO',
    5 => 'SMÂRDAN',
    6 => 'UMF2'
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
            ['id_toner' => 34, 'id_tip_toner' => 19, 'denumire_tip' => 'TN14 (Konica Minolta 1050/1200)', 'office' => 2, 'office_nume' => 'Independenței', 'stoc' => 22, 'consum_referinta' => 105000, 'aparate_compatibile' => [['id_aparat' => 8, 'nume_aparat' => 'UMF-AN3'], ['id_aparat' => 9, 'nume_aparat' => 'UMF-AN2']]],
            ['id_toner' => 35, 'id_tip_toner' => 6, 'denumire_tip' => 'TN622C Cyan (Bizhub Press C1085/C1100)', 'office' => 2, 'office_nume' => 'Independenței', 'stoc' => 6, 'consum_referinta' => 95000, 'aparate_compatibile' => [['id_aparat' => 14, 'nume_aparat' => 'UMF-C1100-1']]],
            ['id_toner' => 36, 'id_tip_toner' => 7, 'denumire_tip' => 'TN622M Magenta (Bizhub Press C1085/C1100)', 'office' => 2, 'office_nume' => 'Independenței', 'stoc' => 5, 'consum_referinta' => 92000, 'aparate_compatibile' => [['id_aparat' => 14, 'nume_aparat' => 'UMF-C1100-1']]],
            ['id_toner' => 37, 'id_tip_toner' => 8, 'denumire_tip' => 'TN622Y Yellow (Bizhub Press C1085/C1100)', 'office' => 2, 'office_nume' => 'Independenței', 'stoc' => 6, 'consum_referinta' => 104000, 'aparate_compatibile' => [['id_aparat' => 14, 'nume_aparat' => 'UMF-C1100-1']]],
            ['id_toner' => 38, 'id_tip_toner' => 9, 'denumire_tip' => 'TN622K Black (Bizhub Press C1085/C1100)', 'office' => 2, 'office_nume' => 'Independenței', 'stoc' => 6, 'consum_referinta' => 88000, 'aparate_compatibile' => [['id_aparat' => 14, 'nume_aparat' => 'UMF-C1100-1']]],
            ['id_toner' => 43, 'id_tip_toner' => 14, 'denumire_tip' => 'TN321C Cyan (Bizhub C224e/C364e)', 'office' => 2, 'office_nume' => 'Independenței', 'stoc' => 5, 'consum_referinta' => 25000, 'aparate_compatibile' => [['id_aparat' => 16, 'nume_aparat' => 'UMF-C364e']]],
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
            ['id_aparat' => 50, 'nume_aparat' => 'TIPO-2250-1-DR', 'office' => 4],
            ['id_aparat' => 51, 'nume_aparat' => 'TIPO-2250-2-DR', 'office' => 4],
            ['id_aparat' => 52, 'nume_aparat' => 'TIPO-2250-3-DR', 'office' => 4],
            ['id_aparat' => 53, 'nume_aparat' => 'TIPO-2250-4-DR', 'office' => 4],
            ['id_aparat' => 54, 'nume_aparat' => 'TIPO-2250-5-DR', 'office' => 4],
            ['id_aparat' => 55, 'nume_aparat' => 'TIPO-2250-6-DR', 'office' => 4],
        ];
        if ($officeId !== null) {
            $mockAparate = array_values(array_filter($mockAparate, function($a) use ($officeId) {
                return $a['office'] === $officeId;
            }));
        }
        sendResponse(true, 'Aparate mock încărcate.', $mockAparate);
    }
}
elseif ($action === 'tonere-aparat') {
    $idAparat = (int)($_GET['id_aparat'] ?? 0);
    
    if ($db) {
        try {
            $sql = "SELECT t.id_toner, t.id_tip_toner, t.office, t.stoc, tt.denumire_tip, tt.consum_referinta
                    FROM tonere_aparate ta
                    JOIN tonere t ON ta.id_toner = t.id_toner
                    JOIN tipuri_toner tt ON t.id_tip_toner = tt.id_tip_toner
                    WHERE ta.id_aparat = :aparat AND t.toner_activ = 1";
            $stmt = $db->prepare($sql);
            $stmt->execute([':aparat' => $idAparat]);
            $res = $stmt->fetchAll();
            
            sendResponse(true, 'Tonere compatibile încărcate.', $res);
        } catch (Throwable $e) {
            sendResponse(false, 'Eroare tonere-aparat: ' . $e->getMessage(), null, 200);
        }
    } else {
        // Mock fallback pe baza aparatului selectat pentru prezentare demo
        $mockMap = [
            // UMF-C454e (id: 45) sau UMF-C364e (id: 16)
            45 => [
                ['id_toner' => 43, 'id_tip_toner' => 14, 'denumire_tip' => 'TN321C', 'stoc' => 5, 'consum_referinta' => 25000],
                ['id_toner' => 44, 'id_tip_toner' => 15, 'denumire_tip' => 'TN321M', 'stoc' => 6, 'consum_referinta' => 25000],
                ['id_toner' => 45, 'id_tip_toner' => 16, 'denumire_tip' => 'TN321Y', 'stoc' => 8, 'consum_referinta' => 25000],
                ['id_toner' => 46, 'id_tip_toner' => 17, 'denumire_tip' => 'TN321K', 'stoc' => 3, 'consum_referinta' => 27000],
                ['id_toner' => 137, 'id_tip_toner' => 51, 'denumire_tip' => 'TN512C', 'stoc' => 4, 'consum_referinta' => 105000],
                ['id_toner' => 138, 'id_tip_toner' => 52, 'denumire_tip' => 'TN512M', 'stoc' => 5, 'consum_referinta' => 105000],
                ['id_toner' => 139, 'id_tip_toner' => 53, 'denumire_tip' => 'TN512Y', 'stoc' => 4, 'consum_referinta' => 105000],
                ['id_toner' => 140, 'id_tip_toner' => 54, 'denumire_tip' => 'TN512K', 'stoc' => 5, 'consum_referinta' => 105000],
            ],
            16 => [
                ['id_toner' => 43, 'id_tip_toner' => 14, 'denumire_tip' => 'TN321C', 'stoc' => 5, 'consum_referinta' => 25000],
                ['id_toner' => 44, 'id_tip_toner' => 15, 'denumire_tip' => 'TN321M', 'stoc' => 6, 'consum_referinta' => 25000],
                ['id_toner' => 45, 'id_tip_toner' => 16, 'denumire_tip' => 'TN321Y', 'stoc' => 8, 'consum_referinta' => 25000],
                ['id_toner' => 46, 'id_tip_toner' => 17, 'denumire_tip' => 'TN321K', 'stoc' => 3, 'consum_referinta' => 27000],
            ],
            14 => [
                ['id_toner' => 35, 'id_tip_toner' => 6, 'denumire_tip' => 'TN622C', 'stoc' => 6, 'consum_referinta' => 95000],
                ['id_toner' => 36, 'id_tip_toner' => 7, 'denumire_tip' => 'TN622M', 'stoc' => 5, 'consum_referinta' => 92000],
                ['id_toner' => 37, 'id_tip_toner' => 8, 'denumire_tip' => 'TN622Y', 'stoc' => 6, 'consum_referinta' => 104000],
                ['id_toner' => 38, 'id_tip_toner' => 9, 'denumire_tip' => 'TN622K', 'stoc' => 6, 'consum_referinta' => 88000],
            ],
            84 => [
                ['id_toner' => 147, 'id_tip_toner' => 6, 'denumire_tip' => 'TN622C', 'stoc' => 6, 'consum_referinta' => 95000],
                ['id_toner' => 148, 'id_tip_toner' => 7, 'denumire_tip' => 'TN622M', 'stoc' => 4, 'consum_referinta' => 92000],
                ['id_toner' => 149, 'id_tip_toner' => 8, 'denumire_tip' => 'TN622Y', 'stoc' => 4, 'consum_referinta' => 104000],
                ['id_toner' => 150, 'id_tip_toner' => 9, 'denumire_tip' => 'TN622K', 'stoc' => 3, 'consum_referinta' => 88000],
            ],
            91 => [
                ['id_toner' => 119, 'id_tip_toner' => 43, 'denumire_tip' => 'TN627C', 'stoc' => 3, 'consum_referinta' => 208000],
                ['id_toner' => 117, 'id_tip_toner' => 44, 'denumire_tip' => 'TN627M', 'stoc' => 4, 'consum_referinta' => 180000],
                ['id_toner' => 118, 'id_tip_toner' => 45, 'denumire_tip' => 'TN627Y', 'stoc' => 5, 'consum_referinta' => 173000],
                ['id_toner' => 120, 'id_tip_toner' => 46, 'denumire_tip' => 'TN627K', 'stoc' => 4, 'consum_referinta' => 174000],
            ],
            34 => [
                ['id_toner' => 87, 'id_tip_toner' => 24, 'denumire_tip' => 'TN619C', 'stoc' => 2, 'consum_referinta' => 45000],
                ['id_toner' => 88, 'id_tip_toner' => 25, 'denumire_tip' => 'TN619M', 'stoc' => 2, 'consum_referinta' => 45000],
                ['id_toner' => 89, 'id_tip_toner' => 26, 'denumire_tip' => 'TN619Y', 'stoc' => 2, 'consum_referinta' => 45000],
                ['id_toner' => 90, 'id_tip_toner' => 27, 'denumire_tip' => 'TN619K', 'stoc' => 2, 'consum_referinta' => 45000],
            ]
        ];

        $mockRes = $mockMap[$idAparat] ?? [
            ['id_toner' => 34, 'id_tip_toner' => 19, 'denumire_tip' => 'TN14', 'stoc' => 22, 'consum_referinta' => 105000]
        ];
        sendResponse(true, 'Tonere compatibile mock.', $mockRes);
    }
}
elseif ($action === 'add-stock' || $action === 'update-stock') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $idToner = (int)($input['id_toner'] ?? 0);
    $cantitate = (int)($input['cantitate'] ?? 0);
    $operation = $input['operation'] ?? 'add';
    $userRole = $input['user_role'] ?? ($input['role'] ?? '');
    
    if (!empty($userRole) && $userRole !== 'admin') {
        sendResponse(false, 'Acces restricționat! Doar administratorii au permisiunea de a modifica stocul de tonere.', null, 403);
    }
    
    if ($idToner <= 0 || $cantitate <= 0) {
        sendResponse(false, 'Selectează un toner și introdu o cantitate validă.', null, 400);
    }
    
    if ($db) {
        if ($operation === 'subtract') {
            $stmt = $db->prepare("UPDATE tonere SET stoc = GREATEST(0, stoc - :cantitate) WHERE id_toner = :id");
            $stmt->execute([':cantitate' => $cantitate, ':id' => $idToner]);
            sendResponse(true, "Stocul a fost redus cu -{$cantitate} bucăți.");
        } else {
            $stmt = $db->prepare("UPDATE tonere SET stoc = stoc + :cantitate WHERE id_toner = :id");
            $stmt->execute([':cantitate' => $cantitate, ':id' => $idToner]);
            sendResponse(true, "Stocul a fost suplimentat cu +{$cantitate} bucăți.");
        }
    } else {
        $sign = ($operation === 'subtract') ? '-' : '+';
        sendResponse(true, "Stocul a fost actualizat cu {$sign}{$cantitate} bucăți (Demo).");
    }
}
