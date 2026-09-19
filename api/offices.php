<?php
// PIM Iași - Endpoint Gestiune Sedii (Offices API)
require_once __DIR__ . '/config.php';

$db = getDBConnection();
$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$action = $input['action'] ?? $_GET['action'] ?? 'list';

// 1.1 Protecție prin sesiune/token
$authUser = requireAuth(null, $db);

if ($action === 'list') {
    $offices = getOfficesList($db);
    sendResponse(true, 'Lista de sedii a fost încărcată.', $offices);
}
elseif ($action === 'save') {
    // Doar administratorii pot adăuga sau modifica un sediu
    $authAdmin = requireAuth('admin', $db);

    $idOffice = (int)($input['id_office'] ?? 0);
    $numeSediu = trim($input['nume_sediu'] ?? '');
    $adresa = trim($input['adresa'] ?? '');
    $activ = isset($input['activ']) ? (int)$input['activ'] : 1;

    if ($idOffice <= 0 || empty($numeSediu)) {
        sendResponse(false, 'ID-ul și denumirea sediului sunt obligatorii.', null, 400);
    }

    if ($db) {
        try {
            $stmt = $db->prepare("INSERT INTO sedii (id_office, nume_sediu, adresa, activ) 
                                 VALUES (:id, :nume, :adresa, :activ)
                                 ON DUPLICATE KEY UPDATE nume_sediu = VALUES(nume_sediu), adresa = VALUES(adresa), activ = VALUES(activ)");
            $stmt->execute([
                ':id' => $idOffice,
                ':nume' => $numeSediu,
                ':adresa' => $adresa,
                ':activ' => $activ
            ]);
            sendResponse(true, "Sediul '{$numeSediu}' a fost salvat cu succes.");
        } catch (Throwable $e) {
            sendResponse(false, 'Eroare la salvare sediu: ' . $e->getMessage(), null, 500);
        }
    } else {
        sendResponse(true, "Sediul '{$numeSediu}' salvat (Demo).");
    }
}
else {
    sendResponse(false, 'Acțiune invalidă.', null, 400);
}
