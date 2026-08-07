<?php
require_once __DIR__ . '/config.php';

$res = [];
try {
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO_ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    
    $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM istoric_schimbari");
    $cnt = $stmt->fetch()['cnt'];
    
    $res = ['status' => 'OK', 'message' => 'Conectat cu succes!', 'total_schimbari' => $cnt];
} catch (PDOException $e) {
    $res = ['status' => 'ERROR', 'error' => $e->getMessage()];
}

echo json_encode($res, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
