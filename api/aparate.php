<?php
// =============================================================================
// PIM Iași - Endpoint Gestiune Aparate (Aparate API)
// =============================================================================
require_once __DIR__ . '/config.php';

$db = getDBConnection();
$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$action = $input['action'] ?? $_GET['action'] ?? 'list';
$officeId = isset($_GET['office']) ? (int)$_GET['office'] : null;

if ($db) {
    ensureAparatContorInitialColumn($db);
}

// -----------------------------------------------------------------------------
// 1. LISTARE APARATE
// -----------------------------------------------------------------------------
if ($action === 'list') {
    $authUser = requireAuth(null, $db);

    if ($db) {
        $sql = "SELECT id_aparat, nume_aparat, office, aparat_activ, contor_initial FROM aparate WHERE 1=1";
        if (isset($_GET['only_active']) && $_GET['only_active'] == '1') {
            $sql .= " AND aparat_activ = 1";
        }
        if ($officeId !== null) {
            $sql .= " AND office = " . (int)$officeId;
        }
        $sql .= " ORDER BY nume_aparat ASC";
        $stmt = $db->query($sql);
        $rows = $stmt ? $stmt->fetchAll() : [];
        foreach ($rows as &$r) {
            $r['id_aparat'] = (int)$r['id_aparat'];
            $r['office'] = (int)$r['office'];
            $r['aparat_activ'] = (int)$r['aparat_activ'];
            $r['contor_initial'] = (int)($r['contor_initial'] ?? 0);
        }
        sendResponse(true, 'Aparate încărcate.', $rows);
    } else {
        $mockAparate = [
            ['id_aparat' => 8, 'nume_aparat' => 'UMF-AN3', 'office' => 2, 'aparat_activ' => 1, 'contor_initial' => 0],
            ['id_aparat' => 9, 'nume_aparat' => 'UMF-AN2', 'office' => 2, 'aparat_activ' => 1, 'contor_initial' => 0],
            ['id_aparat' => 14, 'nume_aparat' => 'UMF-C1100-1', 'office' => 2, 'aparat_activ' => 1, 'contor_initial' => 0],
            ['id_aparat' => 16, 'nume_aparat' => 'UMF-C364e', 'office' => 2, 'aparat_activ' => 1, 'contor_initial' => 0],
            ['id_aparat' => 20, 'nume_aparat' => 'TUDOR-T1', 'office' => 3, 'aparat_activ' => 1, 'contor_initial' => 0],
            ['id_aparat' => 27, 'nume_aparat' => 'SMARDAN-1250-1', 'office' => 5, 'aparat_activ' => 1, 'contor_initial' => 0],
            ['id_aparat' => 48, 'nume_aparat' => 'TIPO-1250-3', 'office' => 4, 'aparat_activ' => 1, 'contor_initial' => 0],
        ];
        sendResponse(true, 'Aparate mock încărcate.', $mockAparate);
    }
}

// -----------------------------------------------------------------------------
// 2. SALVARE APARAT NOU SAU ACTUALIZARE (CU CONTOR INIȚIAL)
// -----------------------------------------------------------------------------
elseif ($action === 'save' || $action === 'save-aparat') {
    $authAdmin = requireAuth('admin', $db);

    $numeAparat = trim($input['nume_aparat'] ?? '');
    $officeIdVal = (int)($input['office'] ?? 2);
    $contorInitial = isset($input['contor_initial']) ? (int)$input['contor_initial'] : 0;
    $tonereCompatibile = $input['tonere_ids'] ?? [];

    if (empty($numeAparat)) {
        sendResponse(false, 'Numele aparatului este obligatoriu.', null, 400);
    }

    if ($db) {
        try {
            $db->beginTransaction();

            $stmtCheck = $db->prepare("SELECT id_aparat FROM aparate WHERE nume_aparat = :n LIMIT 1");
            $stmtCheck->execute([':n' => $numeAparat]);
            $existing = $stmtCheck->fetch();

            if ($existing) {
                $idAparat = (int)$existing['id_aparat'];
                $stmtUpd = $db->prepare("UPDATE aparate SET office = :off, aparat_activ = 1, contor_initial = :ci WHERE id_aparat = :id");
                $stmtUpd->execute([':off' => $officeIdVal, ':ci' => $contorInitial, ':id' => $idAparat]);
            } else {
                $stmtIns = $db->prepare("INSERT INTO aparate (nume_aparat, office, contor_initial, aparat_activ) VALUES (:n, :off, :ci, 1)");
                $stmtIns->execute([':n' => $numeAparat, ':off' => $officeIdVal, ':ci' => $contorInitial]);
                $idAparat = (int)$db->lastInsertId();
            }

            // Actualizare asocieri în `tonere_aparate`
            if (!empty($tonereCompatibile)) {
                foreach ($tonereCompatibile as $valId) {
                    $valId = (int)$valId;
                    if ($valId <= 0) continue;

                    // Identificare id_tip_toner
                    $idTipToner = null;
                    $stmtCheckTip = $db->prepare("SELECT id_tip_toner FROM tipuri_toner WHERE id_tip_toner = :id LIMIT 1");
                    $stmtCheckTip->execute([':id' => $valId]);
                    $rowTip = $stmtCheckTip->fetch();
                    if ($rowTip) {
                        $idTipToner = (int)$rowTip['id_tip_toner'];
                    } else {
                        $stmtCheckTon = $db->prepare("SELECT id_tip_toner FROM tonere WHERE id_toner = :id LIMIT 1");
                        $stmtCheckTon->execute([':id' => $valId]);
                        $rowTon = $stmtCheckTon->fetch();
                        if ($rowTon) {
                            $idTipToner = (int)$rowTon['id_tip_toner'];
                        }
                    }

                    if (!$idTipToner) continue;

                    // Creare / reactivare toner la sediul aparatului dacă nu există
                    $stmtGetToner = $db->prepare("SELECT id_toner FROM tonere WHERE id_tip_toner = :tip AND office = :off LIMIT 1");
                    $stmtGetToner->execute([':tip' => $idTipToner, ':off' => $officeIdVal]);
                    $existingToner = $stmtGetToner->fetch();

                    if ($existingToner) {
                        $realTonerId = (int)$existingToner['id_toner'];
                        $stmtReact = $db->prepare("UPDATE tonere SET toner_activ = 1 WHERE id_toner = :id");
                        $stmtReact->execute([':id' => $realTonerId]);
                    } else {
                        $stmtInsToner = $db->prepare("INSERT INTO tonere (id_tip_toner, office, stoc, toner_activ) VALUES (:tip, :off, 0, 1)");
                        $stmtInsToner->execute([':tip' => $idTipToner, ':off' => $officeIdVal]);
                        $realTonerId = (int)$db->lastInsertId();
                    }

                    // Inserare legătură în `tonere_aparate`
                    $stmtCheckLeg = $db->prepare("SELECT COUNT(*) as cnt FROM tonere_aparate WHERE id_toner = :t AND id_aparat = :a");
                    $stmtCheckLeg->execute([':t' => $realTonerId, ':a' => $idAparat]);
                    if ($stmtCheckLeg->fetch()['cnt'] == 0) {
                        $stmtInsLeg = $db->prepare("INSERT INTO tonere_aparate (id_toner, id_aparat) VALUES (:t, :a)");
                        $stmtInsLeg->execute([':t' => $realTonerId, ':a' => $idAparat]);
                    }
                }
            }

            $db->commit();
            sendResponse(true, "Aparatul '{$numeAparat}' și contorul inițial ({$contorInitial}) au fost salvate cu succes!", [
                'id_aparat' => $idAparat,
                'nume_aparat' => $numeAparat,
                'contor_initial' => $contorInitial
            ]);
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            sendResponse(false, 'Eroare la salvare aparat: ' . $e->getMessage(), null, 500);
        }
    } else {
        sendResponse(true, "Aparat '{$numeAparat}' salvat cu succes (Demo).", [
            'id_aparat' => rand(100, 999),
            'nume_aparat' => $numeAparat,
            'contor_initial' => $contorInitial
        ]);
    }
}

// -----------------------------------------------------------------------------
// 3. PRELUARE CONTOR ANTERIOR (PASUL 1: istoric_schimbari, PASUL 2: contor_initial)
// -----------------------------------------------------------------------------
elseif ($action === 'get-last-index' || $action === 'get-last-counter') {
    $authUser = requireAuth(null, $db);
    $idAparat = (int)($_GET['id_aparat'] ?? 0);
    $idToner = (int)($_GET['id_toner'] ?? 0);

    if ($idAparat <= 0) {
        sendResponse(false, 'Aparatul este obligatoriu.', null, 400);
    }

    if ($db) {
        $idTipToner = 0;
        if ($idToner > 0) {
            $stmtT = $db->prepare("SELECT id_tip_toner FROM tonere WHERE id_toner = :id");
            $stmtT->execute([':id' => $idToner]);
            $tRow = $stmtT->fetch();
            if ($tRow) {
                $idTipToner = (int)$tRow['id_tip_toner'];
            } else {
                $idTipToner = $idToner;
            }
        }

        // Pasul 1: Căutare în istoric_schimbari
        $sqlIndex = "SELECT s.contor 
                     FROM istoric_schimbari s
                     LEFT JOIN tonere t ON s.id_toner = t.id_toner
                     WHERE s.id_aparat = :aparat";
        $paramsIndex = [':aparat' => $idAparat];

        if ($idToner > 0) {
            if ($idTipToner > 0) {
                $sqlIndex .= " AND (s.id_toner = :id_toner OR t.id_tip_toner = :id_tip_toner)";
                $paramsIndex[':id_toner'] = $idToner;
                $paramsIndex[':id_tip_toner'] = $idTipToner;
            } else {
                $sqlIndex .= " AND s.id_toner = :id_toner";
                $paramsIndex[':id_toner'] = $idToner;
            }
        }

        $sqlIndex .= " ORDER BY s.data_schimbare DESC, s.id_istoric_schimbare DESC LIMIT 1";
        $stmt = $db->prepare($sqlIndex);
        $stmt->execute($paramsIndex);
        $row = $stmt->fetch();

        $isFallbackInitial = false;
        // Pasul 2 (Fallback): Dacă interogarea de mai sus NU returnează niciun rând:
        if (!$row) {
            $stmtFallback = $db->prepare("SELECT contor_initial AS contor FROM aparate WHERE id_aparat = :aparat LIMIT 1");
            $stmtFallback->execute([':aparat' => $idAparat]);
            $row = $stmtFallback->fetch();
            $isFallbackInitial = true;
        }

        $indexVechi = $row ? (int)$row['contor'] : 0;

        $consumReferinta = 105000;
        if ($idToner > 0) {
            $stmtRef = $db->prepare("
                SELECT tt.consum_referinta 
                FROM tipuri_toner tt 
                LEFT JOIN tonere t ON t.id_tip_toner = tt.id_tip_toner 
                WHERE t.id_toner = :toner1 OR tt.id_tip_toner = :toner2 
                ORDER BY tt.id_tip_toner DESC 
                LIMIT 1
            ");
            $stmtRef->execute([':toner1' => $idToner, ':toner2' => ($idTipToner ?: $idToner)]);
            $refRow = $stmtRef->fetch();
            $rawRef = ($refRow && isset($refRow['consum_referinta'])) ? (int)$refRow['consum_referinta'] : 0;
            if ($rawRef > 0) {
                $consumReferinta = $rawRef;
            }
        }

        $minContor = $indexVechi + 1;
        $maxContor = $indexVechi + ($consumReferinta * 2);

        sendResponse(true, 'Index vechi calculat cu succes.', [
            'index_vechi' => $indexVechi,
            'is_fallback_initial' => $isFallbackInitial,
            'contor_initial' => $isFallbackInitial ? $indexVechi : null,
            'consum_referinta' => $consumReferinta,
            'min_contor' => $minContor,
            'max_contor' => $maxContor
        ]);
    } else {
        $mockIndex = 39823097;
        $mockRef = 105000;
        sendResponse(true, 'Index vechi mock calculat.', [
            'index_vechi' => $mockIndex,
            'is_fallback_initial' => false,
            'contor_initial' => null,
            'consum_referinta' => $mockRef,
            'min_contor' => $mockIndex + 1,
            'max_contor' => $mockIndex + ($mockRef * 2)
        ]);
    }
}
else {
    sendResponse(false, 'Acțiune invalidă.', null, 400);
}
