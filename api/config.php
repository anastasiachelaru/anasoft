<?php
// Configurație Bază de Date PIM Iași - Toner Management System
header('Content-Type: application/json; charset=utf-8');

// 1.4 Politici CORS Restricționate și Securizate
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = [
    'https://portal.pim.ro',
    'https://dev.pim.ro',
    'http://localhost',
    'http://127.0.0.1'
];
if (!empty($origin) && in_array($origin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header("Access-Control-Allow-Origin: https://portal.pim.ro");
}
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 1.3 Încărcare variabile de mediu din .env.php protejat (dacă există pe server)
$envFile = __DIR__ . '/.env.php';
$env = [];
if (file_exists($envFile)) {
    $env = include $envFile;
}

$host = $_SERVER['HTTP_HOST'] ?? '';
$isPortal = (stristr($host, 'portal.pim.ro') !== false);

if ($isPortal) {
    define('DB_HOST', $env['PORTAL_DB_HOST'] ?? 'localhost');
    define('DB_NAME', $env['PORTAL_DB_NAME'] ?? 'pimro1_portaldb');
    define('DB_USER', $env['PORTAL_DB_USER'] ?? 'pimro1_portaluser');
    define('DB_PASS', $env['PORTAL_DB_PASS'] ?? 'Bn)%~+#LTwi+J^2(');
} else {
    define('DB_HOST', $env['DEV_DB_HOST'] ?? 'localhost');
    define('DB_NAME', $env['DEV_DB_NAME'] ?? 'pimro1_devdb');
    define('DB_USER', $env['DEV_DB_USER'] ?? 'pimro1_devuser');
    define('DB_PASS', $env['DEV_DB_PASS'] ?? 'TjYYa=94,VMw38P&');
}
define('DEPLOY_SECRET', $env['DEPLOY_SECRET'] ?? 'pimro1_anasoft_deploy_2026');

function getDBConnection() {
    try {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => true,
        ]);
        return $pdo;
    } catch (PDOException $e) {
        try {
            $altHost = (DB_HOST === 'localhost') ? '127.0.0.1' : 'localhost';
            $dsn = "mysql:host=" . $altHost . ";dbname=" . DB_NAME . ";charset=utf8mb4";
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => true,
            ]);
            return $pdo;
        } catch (PDOException $e2) {
            return null;
        }
    }
}

// 1.1 Management Sesiuni Securizate PHP & Token
function startSessionIfNeeded() {
    if (session_status() === PHP_SESSION_NONE) {
        $lifetime = 60 * 60 * 24 * 7; // 7 zile
        ini_set('session.cookie_lifetime', (string)$lifetime);
        ini_set('session.gc_maxlifetime', (string)$lifetime);
        ini_set('session.cookie_httponly', '1');
        ini_set('session.use_only_cookies', '1');
        if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
            ini_set('session.cookie_secure', '1');
        }
        @session_start();
    }
}

function getAuthenticatedUser($db = null) {
    startSessionIfNeeded();
    
    // 1. Verificare din $_SESSION
    if (!empty($_SESSION['pim_user']) && is_array($_SESSION['pim_user'])) {
        return $_SESSION['pim_user'];
    }
    
    // 2. Verificare din Authorization Bearer <token>
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    $token = '';
    if (preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
        $token = $matches[1];
    } elseif (!empty($_GET['auth_token'])) {
        $token = trim((string)$_GET['auth_token']);
    }

    if (!empty($token) && !empty($_SESSION['auth_tokens'][$token])) {
        return $_SESSION['auth_tokens'][$token];
    }

    return null;
}

function requireAuth($requiredRole = null, $db = null) {
    $user = getAuthenticatedUser($db);
    
    if (!$user) {
        sendResponse(false, 'Sesiune neautorizată sau expirată. Te rugăm să te conectezi.', null, 401);
    }
    
    if ($requiredRole === 'admin') {
        $role = strtolower(trim($user['role'] ?? ''));
        if ($role !== 'admin') {
            sendResponse(false, 'Acces interzis. Această acțiune este rezervată exclusiv Administratorilor.', null, 403);
        }
    }
    
    return $user;
}

function sendResponse($success, $message = '', $data = null, $code = 200) {
    http_response_code($code);
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data,
        'timestamp' => date('Y-m-d H:i:s')
    ], JSON_UNESCAPED_UNICODE);
    exit();
}
