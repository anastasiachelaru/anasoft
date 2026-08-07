<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/config.php';

try {
    $db = getDBConnection();
    if (!$db) {
        die(json_encode(['error' => 'DB connection returned null']));
    }
    
    $sql = "SELECT s.id_istoric_schimbare, s.id_aparat, s.id_toner, s.contor, s.data_schimbare, 
                   s.id_user, s.copii_realizate, s.consum_referinta, s.procent_realizat,
                   a.nume_aparat, a.office,
                   tt.denumire_tip,
                   CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS nume_operator, u.username
            FROM istoric_schimbari s
            LEFT JOIN aparate a ON s.id_aparat = a.id_aparat
            LEFT JOIN tonere t ON s.id_toner = t.id_toner
            LEFT JOIN tipuri_toner tt ON t.id_tip_toner = tt.id_tip_toner
            LEFT JOIN users u ON s.id_user = u.id_user
            ORDER BY s.data_schimbare DESC, s.id_istoric_schimbare DESC LIMIT 10";
            
    $stmt = $db->prepare($sql);
    $stmt->execute();
    $rows = $stmt->fetchAll();
    
    echo json_encode(['status' => 'OK', 'count' => count($rows), 'sample' => array_slice($rows, 0, 3)], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
} catch (Throwable $t) {
    echo json_encode(['status' => 'ERROR', 'message' => $t->getMessage(), 'file' => $t->getFile(), 'line' => $t->getLine()]);
}
