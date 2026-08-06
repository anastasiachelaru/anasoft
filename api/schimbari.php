<?php
require_once __DIR__ . '/config.php';

$db = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? $_POST['action'] ?? 'list';

if ($action === 'list') {
    $officeId = isset($_GET['office']) ? (int)$_GET['office'] : null;
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
    
    if ($db) {
        $sql = "SELECT s.id_istoric_schimbare, s.id_aparat, s.id_toner, s.contor, s.data_schimbare, 
                       s.id_user, s.copii_realizate, s.consum_referinta, s.procent_realizat,
                       a.nume_aparat, a.office,
                       tt.denumire_tip,
                       CONCAT(u.first_name, ' ', u.last_name) AS nume_operator, u.username
                FROM istoric_schimbari s
                JOIN aparate a ON s.id_aparat = a.id_aparat
                JOIN tonere t ON s.id_toner = t.id_toner
                JOIN tipuri_toner tt ON t.id_tip_toner = tt.id_tip_toner
                JOIN users u ON s.id_user = u.id_user";
        
        $params = [];
        if ($officeId !== null) {
            $sql .= " WHERE a.office = :office";
            $params[':office'] = $officeId;
        }
        
        $sql .= " ORDER BY s.data_schimbare DESC LIMIT " . $limit;
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        
        sendResponse(true, 'Istoric schimbări încărcat.', $stmt->fetchAll());
    } else {
        // Mock istoric din pimcopyr_toner.sql
        $mockSchimbari = [
            [
                'id_istoric_schimbare' => 86,
                'nume_aparat' => 'UMF-AN5',
                'denumire_tip' => 'TN14 Black',
                'contor' => 33994234,
                'data_schimbare' => '2026-08-06 18:50:00',
                'nume_operator' => 'Florin C.',
                'username' => 'florinc',
                'copii_realizate' => 102450,
                'consum_referinta' => 105000,
                'procent_realizat' => 97.5
            ],
            [
                'id_istoric_schimbare' => 85,
                'nume_aparat' => 'UMF-AN3',
                'denumire_tip' => 'TN14 Black',
                'contor' => 4511306,
                'data_schimbare' => '2026-08-05 14:35:00',
                'nume_operator' => 'Liviu C.',
                'username' => 'liviuc',
                'copii_realizate' => 98400,
                'consum_referinta' => 105000,
                'procent_realizat' => 93.7
            ],
            [
                'id_istoric_schimbare' => 83,
                'nume_aparat' => 'UMF-C1100-1',
                'denumire_tip' => 'TN622M Magenta',
                'contor' => 12794059,
                'data_schimbare' => '2026-08-04 12:19:00',
                'nume_operator' => 'Valentin S.',
                'username' => 'valentin',
                'copii_realizate' => 89200,
                'consum_referinta' => 92000,
                'procent_realizat' => 96.9
            ]
        ];
        sendResponse(true, 'Istoric mock încărcat.', $mockSchimbari);
    }
}
elseif ($action === 'add') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    
    $idAparat = (int)($input['id_aparat'] ?? 0);
    $idToner = (int)($input['id_toner'] ?? 0);
    $idUser = (int)($input['id_user'] ?? 1);
    $contor = (int)($input['contor'] ?? 0);
    
    if ($idAparat <= 0 || $idToner <= 0 || $contor <= 0) {
        sendResponse(false, 'Te rugăm să completezi aparatul, tonerul și contorul curent al aparatului.', null, 400);
    }
    
    if ($db) {
        // Caută schimbarea anterioară pentru calculul de copii realizate
        $stmtPrev = $db->prepare("SELECT contor FROM istoric_schimbari WHERE id_aparat = :aparat AND id_toner = :toner ORDER BY data_schimbare DESC LIMIT 1");
        $stmtPrev->execute([':aparat' => $idAparat, ':toner' => $idToner]);
        $prevEntry = $stmtPrev->fetch();
        
        $copiiRealizate = 0;
        if ($prevEntry && $contor > $prevEntry['contor']) {
            $copiiRealizate = $contor - (int)$prevEntry['contor'];
        }
        
        // Preluare consum referință
        $stmtRef = $db->prepare("SELECT tt.consum_referinta 
                                 FROM tonere t 
                                 JOIN tipuri_toner tt ON t.id_tip_toner = tt.id_tip_toner 
                                 WHERE t.id_toner = :toner");
        $stmtRef->execute([':toner' => $idToner]);
        $refEntry = $stmtRef->fetch();
        $consumReferinta = $refEntry ? (int)$refEntry['consum_referinta'] : 0;
        
        $procentRealizat = ($consumReferinta > 0 && $copiiRealizate > 0) ? round(($copiiRealizate / $consumReferinta) * 100, 2) : 0;
        
        // Inserare în istoric
        $stmtIns = $db->prepare("INSERT INTO istoric_schimbari 
                                 (id_aparat, id_toner, contor, data_schimbare, id_user, copii_realizate, consum_referinta, procent_realizat)
                                 VALUES (:aparat, :toner, :contor, NOW(), :user, :copii, :ref, :procent)");
        $stmtIns->execute([
            ':aparat' => $idAparat,
            ':toner' => $idToner,
            ':contor' => $contor,
            ':user' => $idUser,
            ':copii' => $copiiRealizate,
            ':ref' => $consumReferinta,
            ':procent' => $procentRealizat
        ]);
        
        // Scădere din stoc
        $stmtStock = $db->prepare("UPDATE tonere SET stoc = stoc - 1 WHERE id_toner = :toner");
        $stmtStock->execute([':toner' => $idToner]);
        
        sendResponse(true, 'Schimbarea de toner a fost înregistrată cu succes! Stocul a fost scăzut.', [
            'id_schimbare' => $db->lastInsertId(),
            'copii_realizate' => $copiiRealizate,
            'procent_realizat' => $procentRealizat
        ]);
    } else {
        sendResponse(true, 'Schimbarea de toner a fost înregistrată cu succes! (Demo)', [
            'id_schimbare' => rand(100, 999),
            'copii_realizate' => 95400,
            'procent_realizat' => 95.4
        ]);
    }
}
