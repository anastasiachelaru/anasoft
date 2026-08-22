<?php
require_once __DIR__ . '/config.php';

$db = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? $_POST['action'] ?? 'list';

$officesMap = [
    2 => 'Independenței',
    3 => 'Tudor',
    4 => 'Tipografie',
    5 => 'Smârdan',
    6 => 'UMF 2'
];

if ($action === 'list') {
    $officeId = isset($_GET['office']) ? (int)$_GET['office'] : null;
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 5000;
    
    if ($db) {
        try {
            $sql = "SELECT s.id_istoric_schimbare, s.id_aparat, s.id_toner, s.contor, s.data_schimbare, 
                           s.id_user, s.copii_realizate, s.consum_referinta, s.procent_realizat,
                           a.nume_aparat, a.office,
                           tt.denumire_tip,
                           CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS nume_operator,
                           u.username, u.first_name, u.last_name
                    FROM istoric_schimbari s
                    LEFT JOIN aparate a ON s.id_aparat = a.id_aparat
                    LEFT JOIN tonere t ON s.id_toner = t.id_toner
                    LEFT JOIN tipuri_toner tt ON t.id_tip_toner = tt.id_tip_toner
                    LEFT JOIN users u ON s.id_user = u.id_user";
            
            $params = [];
            if ($officeId !== null) {
                $sql .= " WHERE a.office = :office";
                $params[':office'] = $officeId;
            }
            
            $sql .= " ORDER BY s.data_schimbare DESC, s.id_istoric_schimbare DESC LIMIT " . $limit;
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $schimbari = $stmt->fetchAll();
            
            foreach ($schimbari as &$s) {
                $s['office_nume'] = $officesMap[$s['office'] ?? 0] ?? 'PIM';
                $s['nume_operator'] = trim($s['nume_operator'] ?? '');
                if (empty($s['nume_operator'])) {
                    $s['nume_operator'] = !empty($s['username']) ? $s['username'] : 'operator';
                }
            }
            
            sendResponse(true, 'Istoric schimbări încărcat.', $schimbari);
        } catch (Throwable $e) {
            sendResponse(false, 'Eroare SQL istoric: ' . $e->getMessage(), null, 200);
        }
    } else {
        // Mock istoric din pimcopyr_toner.sql
        $mockSchimbari = [
            [
                'id_istoric_schimbare' => 11897,
                'nume_aparat' => 'TIPO-2250-5-ST',
                'denumire_tip' => 'TN14',
                'contor' => 39823159,
                'data_schimbare' => '2026-08-06 19:19:00',
                'nume_operator' => 'Andreea Poturu',
                'username' => 'poturuandreea',
                'copii_realizate' => 64216,
                'consum_referinta' => 105000,
                'procent_realizat' => 61.16
            ],
            [
                'id_istoric_schimbare' => 11896,
                'nume_aparat' => 'TIPO-2250-5-DR',
                'denumire_tip' => 'TN14',
                'contor' => 39823097,
                'data_schimbare' => '2026-08-06 19:19:00',
                'nume_operator' => 'Andreea Poturu',
                'username' => 'poturuandreea',
                'copii_realizate' => 64216,
                'consum_referinta' => 105000,
                'procent_realizat' => 61.16
            ],
            [
                'id_istoric_schimbare' => 11894,
                'nume_aparat' => 'TIPO-2250-4-ST',
                'denumire_tip' => 'TN14',
                'contor' => 80270366,
                'data_schimbare' => '2026-08-06 10:03:00',
                'nume_operator' => 'Alina',
                'username' => 'alina',
                'copii_realizate' => 62013,
                'consum_referinta' => 105000,
                'procent_realizat' => 59.06
            ]
        ];
        sendResponse(true, 'Istoric mock încărcat.', $mockSchimbari);
    }
}
elseif ($action === 'get-last-index') {
    $idAparat = (int)($_GET['id_aparat'] ?? 0);
    $idToner = (int)($_GET['id_toner'] ?? 0);
    
    if ($idAparat <= 0) {
        sendResponse(false, 'Aparatul este obligatoriu.', null, 400);
    }
    if ($idToner <= 0) {
        $idToner = 1;
    }
    
    if ($db) {
        // Caută ultimul contor ("Index Vechi") înregistrat pe APARATUL selectat
        $stmt = $db->prepare("SELECT contor FROM istoric_schimbari WHERE id_aparat = :aparat ORDER BY data_schimbare DESC, id_istoric_schimbare DESC LIMIT 1");
        $stmt->execute([':aparat' => $idAparat]);
        $row = $stmt->fetch();
        $indexVechi = $row ? (int)$row['contor'] : 0;
        
        // Preluare consum referință specific DEDICAT tonerului selectat (căutare după id_toner sau id_tip_toner)
            $stmtRef = $db->prepare("
                SELECT tt.consum_referinta 
                FROM tipuri_toner tt 
                LEFT JOIN tonere t ON t.id_tip_toner = tt.id_tip_toner 
                WHERE t.id_toner = :toner1 OR tt.id_tip_toner = :toner2 
                ORDER BY tt.id_tip_toner DESC 
                LIMIT 1
            ");
            $stmtRef->execute([':toner1' => $idToner, ':toner2' => $idToner]);
        $refRow = $stmtRef->fetch();
        $rawRef = ($refRow && isset($refRow['consum_referinta'])) ? (int)$refRow['consum_referinta'] : 0;
        $consumReferinta = ($rawRef > 0) ? $rawRef : 105000;
        
        $minContor = $indexVechi + 1;
        $maxContor = $indexVechi + ($consumReferinta * 2);
        
        sendResponse(true, 'Index vechi calculat cu succes.', [
            'index_vechi' => $indexVechi,
            'consum_referinta' => $consumReferinta,
            'min_contor' => $minContor,
            'max_contor' => $maxContor
        ]);
    } else {
        // Mock fallback
        $mockIndex = 39823097;
        $mockRef = 105000;
        sendResponse(true, 'Index vechi mock calculat.', [
            'index_vechi' => $mockIndex,
            'consum_referinta' => $mockRef,
            'min_contor' => $mockIndex + 1,
            'max_contor' => $mockIndex + ($mockRef * 2)
        ]);
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
        try {
            // Verificăm dacă idToner este în tabela tonere. Dacă este id_tip_toner, găsim tonerul corespunzător.
            $stmtChkToner = $db->prepare("SELECT id_toner FROM tonere WHERE id_toner = :id");
            $stmtChkToner->execute([':id' => $idToner]);
            $tonerExists = $stmtChkToner->fetch();

            if (!$tonerExists) {
                $stmtApOffice = $db->prepare("SELECT office FROM aparate WHERE id_aparat = :id");
                $stmtApOffice->execute([':id' => $idAparat]);
                $apRow = $stmtApOffice->fetch();
                $officeAp = $apRow ? (int)$apRow['office'] : 0;

                $stmtFindRealToner = $db->prepare("SELECT id_toner FROM tonere WHERE id_tip_toner = :tip AND (office = :off OR office = 0) ORDER BY stoc DESC LIMIT 1");
                $stmtFindRealToner->execute([':tip' => $idToner, ':off' => $officeAp]);
                $realToner = $stmtFindRealToner->fetch();

                if ($realToner) {
                    $idToner = (int)$realToner['id_toner'];
                } else {
                    $stmtAnyToner = $db->query("SELECT id_toner FROM tonere LIMIT 1");
                    $anyToner = $stmtAnyToner ? $stmtAnyToner->fetch() : null;
                    if ($anyToner) {
                        $idToner = (int)$anyToner['id_toner'];
                    }
                }
            }

            // Verificare ID User valid pentru FK constraint
            $stmtUser = $db->prepare("SELECT id_user FROM users WHERE id_user = :u");
            $stmtUser->execute([':u' => $idUser]);
            if (!$stmtUser->fetch()) {
                $stmtUserFirst = $db->query("SELECT id_user FROM users LIMIT 1");
                $uFirst = $stmtUserFirst ? $stmtUserFirst->fetch() : null;
                $idUser = $uFirst ? (int)$uFirst['id_user'] : 1;
            }

            // Caută schimbarea anterioară pe aparat pentru calculul de copii realizate
            $stmtPrev = $db->prepare("SELECT contor FROM istoric_schimbari WHERE id_aparat = :aparat ORDER BY data_schimbare DESC, id_istoric_schimbare DESC LIMIT 1");
            $stmtPrev->execute([':aparat' => $idAparat]);
            $prevEntry = $stmtPrev->fetch();
            
            $indexVechi = $prevEntry ? (int)$prevEntry['contor'] : 0;
            $copiiRealizate = ($contor > $indexVechi) ? ($contor - $indexVechi) : 0;
            
            // Preluare consum referință
            $stmtRef = $db->prepare("
                SELECT tt.consum_referinta 
                FROM tipuri_toner tt 
                LEFT JOIN tonere t ON t.id_tip_toner = tt.id_tip_toner 
                WHERE t.id_toner = :toner1 OR tt.id_tip_toner = :toner2 
                ORDER BY tt.id_tip_toner DESC 
                LIMIT 1
            ");
            $stmtRef->execute([':toner1' => $idToner, ':toner2' => $idToner]);
            $refEntry = $stmtRef->fetch();
            $rawRef = ($refEntry && isset($refEntry['consum_referinta'])) ? (int)$refEntry['consum_referinta'] : 0;
            $consumReferinta = ($rawRef > 0) ? $rawRef : 105000;
            
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
            $stmtStock = $db->prepare("UPDATE tonere SET stoc = GREATEST(0, stoc - 1) WHERE id_toner = :toner");
            $stmtStock->execute([':toner' => $idToner]);
            
            sendResponse(true, 'Schimbarea de toner a fost înregistrată cu succes! Stocul a fost scăzut.', [
                'id_schimbare' => $db->lastInsertId(),
                'copii_realizate' => $copiiRealizate,
                'procent_realizat' => $procentRealizat
            ]);
        } catch (Throwable $ex) {
            sendResponse(false, 'Eroare la salvarea schimbării în baza de date: ' . $ex->getMessage(), null, 500);
        }
    } else {
        sendResponse(true, 'Schimbarea de toner a fost înregistrată cu succes! (Demo)', [
            'id_schimbare' => rand(100, 999),
            'copii_realizate' => 12000,
            'procent_realizat' => 11.4
        ]);
    }
}
elseif ($action === 'update-aparat-index') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $idAparat = (int)($input['id_aparat'] ?? 0);
    $numeAparat = trim($input['nume_aparat'] ?? '');
    $contor = (int)($input['contor'] ?? 0);

    if ($idAparat <= 0 || $contor < 0) {
        sendResponse(false, 'Date invalide pentru actualizarea aparatului.', null, 400);
    }

    if ($db) {
        if (!empty($numeAparat)) {
            $stmtAp = $db->prepare("UPDATE aparate SET nume_aparat = :n WHERE id_aparat = :id");
            $stmtAp->execute([':n' => $numeAparat, ':id' => $idAparat]);
        }

        $stmtCheck = $db->prepare("SELECT id_istoric_schimbare FROM istoric_schimbari WHERE id_aparat = :id ORDER BY data_schimbare DESC, id_istoric_schimbare DESC LIMIT 1");
        $stmtCheck->execute([':id' => $idAparat]);
        $lastEntry = $stmtCheck->fetch();

        if ($lastEntry) {
            $stmtUpd = $db->prepare("UPDATE istoric_schimbari SET contor = :c WHERE id_istoric_schimbare = :id");
            $stmtUpd->execute([':c' => $contor, ':id' => $lastEntry['id_istoric_schimbare']]);
        } else {
            $stmtT = $db->query("SELECT id_toner FROM tonere LIMIT 1");
            $tRow = $stmtT ? $stmtT->fetch() : null;
            $tonerIdValid = $tRow ? (int)$tRow['id_toner'] : 34;

            $stmtIns = $db->prepare("INSERT INTO istoric_schimbari (id_aparat, id_toner, contor, data_schimbare, id_user, copii_realizate, consum_referinta, procent_realizat) VALUES (:aparat, :toner, :contor, NOW(), 1, 0, 105000, 0)");
            $stmtIns->execute([':aparat' => $idAparat, ':toner' => $tonerIdValid, ':contor' => $contor]);
        }

        sendResponse(true, 'Indexul și datele aparatului au fost actualizate cu succes.');
    } else {
        sendResponse(true, 'Index aparat actualizat (Mock).');
    }
}
