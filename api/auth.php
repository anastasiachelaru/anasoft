<?php
require_once __DIR__ . '/config.php';

$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$action = $input['action'] ?? $_GET['action'] ?? '';

$db = getDBConnection();

// 1.4 Funcții Rate Limiting pentru PIN (Prevenire Brute-Force per IP)
function getClientIp() {
    return $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
}

function checkPinRateLimit($ip) {
    $tempDir = sys_get_temp_dir();
    $cacheFile = $tempDir . '/pim_pin_' . md5($ip) . '.json';
    $now = time();
    $window = 60; // Fereastră de 60 secunde

    $data = ['attempts' => [], 'blocked_until' => 0];
    if (file_exists($cacheFile)) {
        $content = @file_get_contents($cacheFile);
        if ($content) {
            $parsed = @json_decode($content, true);
            if (is_array($parsed)) $data = $parsed;
        }
    }

    if (!empty($data['blocked_until']) && $data['blocked_until'] > $now) {
        $remaining = $data['blocked_until'] - $now;
        sendResponse(false, "Prea multe încercări greșite de PIN. Te rugăm să aștepți {$remaining} secunde.", null, 429);
    }

    // Păstrăm doar încercările din ultimele 60 de secunde
    $data['attempts'] = array_filter($data['attempts'] ?? [], function($t) use ($now, $window) {
        return ($now - $t) < $window;
    });

    return [$cacheFile, $data, $now];
}

function recordFailedPinAttempt($cacheFile, $data, $now) {
    $maxAttempts = 5;
    $data['attempts'][] = $now;
    if (count($data['attempts']) >= $maxAttempts) {
        $data['blocked_until'] = $now + 60; // Blocare 60 secunde
    }
    @file_put_contents($cacheFile, json_encode($data));
}

function resetPinAttempts($cacheFile) {
    if (file_exists($cacheFile)) {
        @unlink($cacheFile);
    }
}

// ---------------------------------------------------------
// AUTENTIFICARE PIN (OPERATORI & ADMINI)
// ---------------------------------------------------------
if ($action === 'login-pin') {
    $pin = trim((string)($input['pin'] ?? ''));
    $clientIp = getClientIp();
    list($cacheFile, $rateData, $now) = checkPinRateLimit($clientIp);
    
    if ($pin === '' || strlen($pin) === 0) {
        sendResponse(false, 'Te rugăm să introduci codul PIN.', null, 400);
    }
    
    if ($db) {
        try {
            $db->exec("ALTER TABLE users MODIFY COLUMN pin_code VARCHAR(255) DEFAULT NULL");
        } catch (Throwable $e) {}

        // Căutare utilizator după PIN
        $stmt = $db->prepare("SELECT id_user, username, email, role, office, first_name, last_name, cont_active, status, pin_code, password FROM users");
        $stmt->execute();
        $users = $stmt->fetchAll();
        
        $matchedUser = null;
        foreach ($users as $user) {
            if (!empty($user['pin_code'])) {
                // Verificare dacă este Bcrypt hash sau text clar
                if (password_verify($pin, $user['pin_code']) || trim($user['pin_code']) === $pin) {
                    $matchedUser = $user;
                    
                    // 1.2 Migrare automată și silențioasă la Bcrypt (password_hash) pentru PIN
                    if (password_needs_rehash($user['pin_code'], PASSWORD_DEFAULT)) {
                        try {
                            $newHashedPin = password_hash($pin, PASSWORD_DEFAULT);
                            $updPin = $db->prepare("UPDATE users SET pin_code = :h WHERE id_user = :id");
                            $updPin->execute([':h' => $newHashedPin, ':id' => $user['id_user']]);
                        } catch (Throwable $eRehash) {}
                    }
                    break;
                }
            }
        }
        
        if ($matchedUser) {
            resetPinAttempts($cacheFile);

            $userStatus = $matchedUser['status'] ?? ((int)$matchedUser['cont_active'] === 1 ? 'activ' : 'inactiv');
            if ($userStatus === 'inactiv' || (int)$matchedUser['cont_active'] === 0 || $matchedUser['cont_active'] === '0') {
                sendResponse(false, 'Cont inactiv sau inexistent. Vă rugăm să contactați un administrator.', null, 403);
            }

            if ($matchedUser['role'] === 'admin' && (empty($matchedUser['office']) || $matchedUser['office'] === '0' || $matchedUser['office'] === 0)) {
                $matchedUser['office'] = 'ALL';
            }

            // 1.1 Înregistrare sesiune server securizată & token Bearer
            startSessionIfNeeded();
            $authToken = bin2hex(random_bytes(32));
            $sessionUser = [
                'id_user' => (int)$matchedUser['id_user'],
                'username' => $matchedUser['username'],
                'role' => $matchedUser['role'],
                'office' => $matchedUser['office'],
                'first_name' => $matchedUser['first_name'] ?? '',
                'last_name' => $matchedUser['last_name'] ?? '',
                'status' => $userStatus
            ];
            $_SESSION['pim_user'] = $sessionUser;
            if (!isset($_SESSION['auth_tokens'])) $_SESSION['auth_tokens'] = [];
            $_SESSION['auth_tokens'][$authToken] = $sessionUser;

            unset($matchedUser['password']);
            unset($matchedUser['pin_code']);
            sendResponse(true, 'Autentificare reușită cu PIN!', [
                'user' => $sessionUser,
                'token' => $authToken
            ]);
        } else {
            recordFailedPinAttempt($cacheFile, $rateData, $now);
            sendResponse(false, 'Cod PIN incorect.', null, 401);
        }
    } else {
        // Mock fallback demo
        if ($pin === '111111') {
            sendResponse(true, 'Autentificare Operator Demo reușită!', [
                'user' => [
                    'id_user' => 40,
                    'username' => 'operator',
                    'first_name' => 'Operator',
                    'last_name' => 'PIM',
                    'role' => 'operator',
                    'office' => 2,
                    'email' => 'operator@dev.pim.ro',
                    'status' => 'activ'
                ],
                'token' => 'demo_token_' . time()
            ]);
        } else {
            sendResponse(false, 'Cod PIN incorect.', null, 401);
        }
    }
} 
// ---------------------------------------------------------
// AUTENTIFICARE USER & PAROLĂ (ADMINISTRATORI)
// ---------------------------------------------------------
elseif ($action === 'login-password') {
    $username = trim($input['username'] ?? '');
    $password = trim($input['password'] ?? '');
    
    if (empty($username) || empty($password)) {
        sendResponse(false, 'Numele de utilizator și parola sunt obligatorii.', null, 400);
    }
    
    if ($db) {
        $stmt = $db->prepare("SELECT id_user, username, email, role, office, first_name, last_name, cont_active, status, password FROM users WHERE username = :username");
        $stmt->execute([':username' => $username]);
        $user = $stmt->fetch();
        
        if ($user) {
            if ($user['role'] !== 'admin') {
                sendResponse(false, 'Operatorii se pot conecta exclusiv folosind codul PIN de 6 cifre.', null, 403);
            }

            // 1.2 Verificare sigură Bcrypt password_verify cu fallback compatibilitate MD5
            $passwordValid = false;
            if (password_verify($password, $user['password']) || $user['password'] === md5($password) || $user['password'] === $password) {
                $passwordValid = true;

                // Migrare automată de la MD5 la Bcrypt hash la login reușit
                if (password_needs_rehash($user['password'], PASSWORD_DEFAULT)) {
                    try {
                        $newHash = password_hash($password, PASSWORD_DEFAULT);
                        $updPass = $db->prepare("UPDATE users SET password = :p, password_plain = NULL WHERE id_user = :id");
                        $updPass->execute([':p' => $newHash, ':id' => $user['id_user']]);
                    } catch (Throwable $eRehash) {}
                }
            }
            
            if ($passwordValid) {
                $userStatus = $user['status'] ?? ((int)$user['cont_active'] === 1 ? 'activ' : 'inactiv');
                if ($userStatus === 'inactiv' || (int)$user['cont_active'] === 0) {
                    sendResponse(false, 'Cont inactiv sau inexistent. Vă rugăm să contactați un administrator.', null, 403);
                }

                if ($user['role'] === 'admin' && (empty($user['office']) || $user['office'] === '0' || $user['office'] === 0)) {
                    $user['office'] = 'ALL';
                }

                // 1.1 Înregistrare sesiune server securizată & token Bearer
                startSessionIfNeeded();
                $authToken = bin2hex(random_bytes(32));
                $sessionUser = [
                    'id_user' => (int)$user['id_user'],
                    'username' => $user['username'],
                    'role' => $user['role'],
                    'office' => $user['office'],
                    'first_name' => $user['first_name'] ?? '',
                    'last_name' => $user['last_name'] ?? '',
                    'status' => $userStatus
                ];
                $_SESSION['pim_user'] = $sessionUser;
                if (!isset($_SESSION['auth_tokens'])) $_SESSION['auth_tokens'] = [];
                $_SESSION['auth_tokens'][$authToken] = $sessionUser;

                unset($user['password']);
                sendResponse(true, 'Autentificare reușită!', [
                    'user' => $sessionUser,
                    'token' => $authToken
                ]);
            }
        }
        sendResponse(false, 'Utilizator sau parolă incorectă.', null, 401);
    } else {
        // Mock fallback demo
        if (($username === 'anastasia' || $username === 'eugenadmin' || $username === 'admin') && !empty($password)) {
            $isAnastasia = ($username === 'anastasia');
            sendResponse(true, 'Autentificare Demo reușită!', [
                'user' => [
                    'id_user' => $isAnastasia ? 173 : 117,
                    'username' => $username,
                    'first_name' => $isAnastasia ? 'Anastasia' : 'Eugen',
                    'last_name' => 'Admin',
                    'role' => 'admin',
                    'office' => 'ALL',
                    'email' => $username . '@dev.pim.ro'
                ],
                'token' => 'demo_token_' . time()
            ]);
        } else {
            sendResponse(false, 'Nume de utilizator sau parolă incorectă.', null, 401);
        }
    }
}
// ---------------------------------------------------------
// VERIFICARE SESIUNE ACTIVĂ (CHECK-SESSION)
// ---------------------------------------------------------
elseif ($action === 'check-session') {
    $user = getAuthenticatedUser($db);
    if ($user) {
        sendResponse(true, 'Sesiune activă.', ['user' => $user]);
    } else {
        sendResponse(false, 'Sesiune inactivă sau expirată.', null, 401);
    }
}
// ---------------------------------------------------------
// DECONECTARE (LOGOUT)
// ---------------------------------------------------------
elseif ($action === 'logout') {
    startSessionIfNeeded();
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    @session_destroy();
    sendResponse(true, 'Deconectare realizată cu succes.');
}
else {
    sendResponse(false, 'Acțiune invalidă.', null, 400);
}
