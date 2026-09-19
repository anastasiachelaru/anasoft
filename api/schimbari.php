<?php
require_once __DIR__ . '/config.php';

$db = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? $_POST['action'] ?? 'list';

$officesMap = getOfficesMap($db);

if ($action === 'list') {
    $authUser = requireAuth(null, $db);
    $rawOffice = $_GET['office'] ?? null;
    $officeId = ($rawOffice !== null && $rawOffice !== 'all' && $rawOffice !== 'ALL' && $rawOffice !== '') ? (int)$rawOffice : null;
    
    $isAll = (isset($_GET['all']) && $_GET['all'] == '1');
    $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
    $perPage = isset($_GET['per_page']) ? max(1, min(100, (int)$_GET['per_page'])) : (isset($_GET['limit']) ? min(5000, max(1, (int)$_GET['limit'])) : 10);
    if ($isAll) {
        $perPage = 5000;
        $page = 1;
    }
    $search = trim((string)($_GET['search'] ?? ''));
    $offset = ($page - 1) * $perPage;
    
    if ($db) {
        try {
            $where = [];
            $params = [];

            if ($officeId !== null && $officeId > 0) {
                $where[] = "a.office = :office";
                $params[':office'] = $officeId;
            }

            if ($search !== '') {
                $where[] = "(a.nume_aparat LIKE :search1 OR tt.denumire_tip LIKE :search2 OR u.username LIKE :search3 OR u.first_name LIKE :search4 OR u.last_name LIKE :search5 OR s.nume_operator LIKE :search6)";
                $searchLike = '%' . $search . '%';
                $params[':search1'] = $searchLike;
                $params[':search2'] = $searchLike;
                $params[':search3'] = $searchLike;
                $params[':search4'] = $searchLike;
                $params[':search5'] = $searchLike;
                $params[':search6'] = $searchLike;
            }

            $whereSql = !empty($where) ? (' WHERE ' . implode(' AND ', $where)) : '';

            // 1. Numărare totală pe înregistrările filtrate
            $countSql = "SELECT COUNT(*) AS total 
                         FROM istoric_schimbari s
                         LEFT JOIN aparate a ON s.id_aparat = a.id_aparat
                         LEFT JOIN tonere t ON s.id_toner = t.id_toner
                         LEFT JOIN tipuri_toner tt ON t.id_tip_toner = tt.id_tip_toner
                         LEFT JOIN users u ON s.id_user = u.id_user" . $whereSql;

            $stmtCount = $db->prepare($countSql);
            $stmtCount->execute($params);
            $totalRecords = (int)($stmtCount->fetchColumn() ?: 0);
            $totalPages = max(1, (int)ceil($totalRecords / $perPage));

            // 2. Preluare paginată
            $sql = "SELECT s.id_istoric_schimbare, s.id_aparat, s.id_toner, s.contor, s.data_schimbare, 
                           s.id_user, s.copii_realizate, s.consum_referinta, s.procent_realizat,
                           COALESCE(s.nume_operator, '') AS istoric_nume_operator,
                           a.nume_aparat, a.office,
                           tt.denumire_tip,
                           CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS user_full_name,
                           u.username, u.first_name, u.last_name
                    FROM istoric_schimbari s
                    LEFT JOIN aparate a ON s.id_aparat = a.id_aparat
                    LEFT JOIN tonere t ON s.id_toner = t.id_toner
                    LEFT JOIN tipuri_toner tt ON t.id_tip_toner = tt.id_tip_toner
                    LEFT JOIN users u ON s.id_user = u.id_user"
                    . $whereSql
                    . " ORDER BY s.data_schimbare DESC, s.id_istoric_schimbare DESC LIMIT :limit OFFSET :offset";

            $stmt = $db->prepare($sql);
            foreach ($params as $k => $v) {
                $stmt->bindValue($k, $v);
            }
            $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            $schimbari = $stmt->fetchAll();
            
            foreach ($schimbari as &$s) {
                $s['office_nume'] = $officesMap[$s['office'] ?? 0] ?? 'PIM';
                
                $firstName = trim($s['first_name'] ?? '');
                $lastName = trim($s['last_name'] ?? '');
                $fullName = trim($firstName . ' ' . $lastName);
                
                if (empty($fullName)) {
                    $fullName = trim($s['username'] ?? '');
                }

                if (empty($fullName)) {
                    $fullName = trim($s['istoric_nume_operator'] ?? '');
                }
                
                if (empty($fullName) || strtolower($fullName) === 'operator' || strtolower($fullName) === 'operator operator') {
                    $fullName = (!empty($s['username']) && strtolower($s['username']) !== 'operator') ? $s['username'] : (!empty($s['istoric_nume_operator']) ? $s['istoric_nume_operator'] : 'Admin PIM');
                }
                
                $s['nume_operator'] = $fullName;
            }
            
            sendResponse(true, 'Istoric schimbări încărcat.', $schimbari, 200, [
                'total' => $totalRecords,
                'page' => $page,
                'per_page' => $perPage,
                'total_pages' => $totalPages
            ]);
        } catch (Throwable $e) {
            sendResponse(false, 'Eroare SQL istoric: ' . $e->getMessage(), null, 500);
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
    $authUser = requireAuth(null, $db);
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
    $authUser = requireAuth(null, $db);
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    
    $idAparat = (int)($input['id_aparat'] ?? 0);
    $idToner = (int)($input['id_toner'] ?? 0);
    $idUser = (int)($authUser['id_user'] ?? ($input['id_user'] ?? 1));
    $contor = (int)($input['contor'] ?? 0);

    $numeOp = trim(($authUser['first_name'] ?? '') . ' ' . ($authUser['last_name'] ?? ''));
    if (empty($numeOp)) {
        $numeOp = $authUser['username'] ?? 'Operator';
    }
    
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
            
            // Inițiere tranzacție atomică ACID
            $db->beginTransaction();
            try {
                // 1. Verificare și blocare pe rând pentru stoc (FOR UPDATE)
                $stmtLock = $db->prepare("SELECT stoc FROM tonere WHERE id_toner = :toner FOR UPDATE");
                $stmtLock->execute([':toner' => $idToner]);
                $tonerRow = $stmtLock->fetch();

                if (!$tonerRow || (int)$tonerRow['stoc'] <= 0) {
                    $db->rollBack();
                    sendResponse(false, 'Stoc epuizat! Tonerul selectat are 0 bucăți disponibile și nu poate fi instalat.', null, 400);
                }

                // 2. Inserare în istoric_schimbari
                $stmtIns = $db->prepare("INSERT INTO istoric_schimbari 
                                         (id_aparat, id_toner, contor, data_schimbare, id_user, nume_operator, copii_realizate, consum_referinta, procent_realizat)
                                         VALUES (:aparat, :toner, :contor, NOW(), :user, :nume_op, :copii, :ref, :procent)");
                $stmtIns->execute([
                    ':aparat' => $idAparat,
                    ':toner' => $idToner,
                    ':contor' => $contor,
                    ':user' => $idUser,
                    ':nume_op' => $numeOp,
                    ':copii' => $copiiRealizate,
                    ':ref' => $consumReferinta,
                    ':procent' => $procentRealizat
                ]);
                
                $newId = (int)$db->lastInsertId();

                // 3. Scădere din stoc
                $stmtStock = $db->prepare("UPDATE tonere SET stoc = GREATEST(0, stoc - 1) WHERE id_toner = :toner");
                $stmtStock->execute([':toner' => $idToner]);

                // 4. Salvare definitivă a tranzacției atomice
                $db->commit();

                sendResponse(true, 'Schimbarea de toner a fost înregistrată cu succes! Stocul a fost scăzut.', [
                    'id_schimbare' => $newId,
                    'copii_realizate' => $copiiRealizate,
                    'procent_realizat' => $procentRealizat
                ]);
            } catch (Throwable $e) {
                if ($db->inTransaction()) {
                    $db->rollBack();
                }
                throw $e;
            }
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
    $authAdmin = requireAuth('admin', $db);
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
