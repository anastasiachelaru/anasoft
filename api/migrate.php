<?php
// PIM Iași - Endpoint Execuție Migrare Bază de Date
require_once __DIR__ . '/config.php';

$db = getDBConnection();
if (!$db) {
    sendResponse(false, 'Nu s-a putut stabili conexiunea la baza de date.', null, 500);
}

// 1. Verificare Securitate (Secret Webhook sau Sesiune Administrator)
$providedSecret = $_GET['secret'] ?? '';
$isSecretValid = defined('DEPLOY_SECRET') && !empty($providedSecret) && hash_equals(DEPLOY_SECRET, $providedSecret);

if (!$isSecretValid) {
    $authUser = getAuthenticatedUser($db);
    if (!$authUser || ($authUser['role'] ?? '') !== 'admin') {
        sendResponse(false, 'Acces neautorizat. Doar administratorii sau scriptul de deployment pot rula migrările.', null, 403);
    }
}

// 2. Executare instrucțiuni de migrare
$log = [];

$queries = [
    // Creare tabela sedii
    "CREATE TABLE IF NOT EXISTS `sedii` (
        `id_office` INT(11) NOT NULL,
        `nume_sediu` VARCHAR(100) NOT NULL,
        `adresa` VARCHAR(255) DEFAULT NULL,
        `activ` TINYINT(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (`id_office`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;" => "Tabela 'sedii' verificată/creată.",

    // Populare inițială sedii
    "INSERT INTO `sedii` (`id_office`, `nume_sediu`, `activ`) VALUES
        (2, 'Independenței', 1),
        (3, 'Tudor', 1),
        (4, 'Tipografie', 1),
        (5, 'Smârdan', 1),
        (6, 'UMF 2', 1)
     ON DUPLICATE KEY UPDATE `nume_sediu` = VALUES(`nume_sediu`), `activ` = VALUES(`activ`);" => "Date inițiale tabela 'sedii' sincronizate.",

    // Ajustări tabela users
    "ALTER TABLE `users` MODIFY COLUMN `pin_code` VARCHAR(255) DEFAULT NULL;" => "Coloana pin_code modificată la VARCHAR(255).",
    "ALTER TABLE `users` MODIFY COLUMN `role` VARCHAR(50) DEFAULT 'operator';" => "Coloana role verificată.",
    "ALTER TABLE `users` MODIFY COLUMN `office` VARCHAR(50) DEFAULT '4';" => "Coloana office verificată.",
    "ALTER TABLE `users` MODIFY COLUMN `status` VARCHAR(20) DEFAULT 'activ';" => "Coloana status verificată.",
    "ALTER TABLE `users` MODIFY COLUMN `cont_active` TINYINT DEFAULT 1;" => "Coloana cont_active verificată.",
    "UPDATE `users` SET `password_plain` = NULL WHERE `password_plain` IS NOT NULL;" => "Coloana password_plain curățată.",

    // Ajustări istoric
    "ALTER TABLE `ink_history` MODIFY COLUMN `id_user` INT DEFAULT NULL;" => "Coloana id_user din ink_history permite NULL.",
    "UPDATE `users` SET `role` = 'admin', `status` = 'activ', `cont_active` = 1 WHERE `username` IN ('eugenadmin', 'anastasia');" => "Conturile administrative principale sincronizate.",
    "UPDATE `users` SET `office` = 'ALL' WHERE `role` = 'admin' AND (`office` IS NULL OR `office` = '0' OR `office` = 'toate');" => "Sedii administratori normalizate (ALL).",
    "UPDATE `users` SET `office` = '4' WHERE `role` = 'operator' AND (`office` = 'ALL' OR `office` = '0' OR `office` IS NULL OR `office` = '');" => "Sedii operatori normalizate."
];

foreach ($queries as $sql => $desc) {
    try {
        $db->exec($sql);
        $log[] = ['status' => 'success', 'message' => $desc];
    } catch (Throwable $e) {
        $log[] = ['status' => 'warning', 'message' => $desc . ' (' . $e->getMessage() . ')'];
    }
}

// Verificare și adăugare coloană nume_operator în istoric_schimbari dacă lipsește
try {
    $colCheck = $db->query("SHOW COLUMNS FROM `istoric_schimbari` LIKE 'nume_operator'");
    if ($colCheck && !$colCheck->fetch()) {
        $db->exec("ALTER TABLE `istoric_schimbari` ADD COLUMN `nume_operator` VARCHAR(255) DEFAULT NULL");
        $log[] = ['status' => 'success', 'message' => "Coloana 'nume_operator' adăugată în istoric_schimbari."];
    } else {
        $log[] = ['status' => 'info', 'message' => "Coloana 'nume_operator' există deja în istoric_schimbari."];
    }
} catch (Throwable $e) {
    $log[] = ['status' => 'warning', 'message' => "Verificare nume_operator: " . $e->getMessage()];
}

// Verificare și adăugare coloană nume_operator în ink_history dacă lipsește
try {
    $colCheck2 = $db->query("SHOW COLUMNS FROM `ink_history` LIKE 'nume_operator'");
    if ($colCheck2 && !$colCheck2->fetch()) {
        $db->exec("ALTER TABLE `ink_history` ADD COLUMN `nume_operator` VARCHAR(255) DEFAULT NULL");
        $log[] = ['status' => 'success', 'message' => "Coloana 'nume_operator' adăugată în ink_history."];
    } else {
        $log[] = ['status' => 'info', 'message' => "Coloana 'nume_operator' există deja în ink_history."];
    }
} catch (Throwable $e) {
    $log[] = ['status' => 'warning', 'message' => "Verificare ink_history: " . $e->getMessage()];
}

// Verificare și creare indexuri pe istoric_schimbari pentru viteză
$indexes = [
    'idx_istoric_aparat' => "CREATE INDEX idx_istoric_aparat ON `istoric_schimbari` (`id_aparat`)",
    'idx_istoric_data' => "CREATE INDEX idx_istoric_data ON `istoric_schimbari` (`data_schimbare`)"
];
foreach ($indexes as $idxName => $idxSql) {
    try {
        $idxCheck = $db->query("SHOW INDEX FROM `istoric_schimbari` WHERE Key_name = '{$idxName}'");
        if ($idxCheck && !$idxCheck->fetch()) {
            $db->exec($idxSql);
            $log[] = ['status' => 'success', 'message' => "Indexul '{$idxName}' a fost creat."];
        } else {
            $log[] = ['status' => 'info', 'message' => "Indexul '{$idxName}' există deja."];
        }
    } catch (Throwable $e) {
        $log[] = ['status' => 'warning', 'message' => "Index '{$idxName}': " . $e->getMessage()];
    }
}

sendResponse(true, 'Migrarea bazei de date a fost executată cu succes!', [
    'timestamp' => date('Y-m-d H:i:s'),
    'log' => $log
]);
