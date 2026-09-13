<?php
require_once __DIR__ . '/config.php';

$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$action = $input['action'] ?? $_GET['action'] ?? '';

$db = getDBConnection();

if ($action === 'login-pin') {
    $pin = trim((string)($input['pin'] ?? ''));
    
    if ($pin === '' || strlen($pin) === 0) {
        sendResponse(false, 'Te rugăm să introduci codul PIN.', null, 400);
    }
    
    if ($db) {
        try {
            try {
                $db->exec("ALTER TABLE users MODIFY COLUMN pin_code VARCHAR(32) DEFAULT NULL");
            } catch (Throwable $e) {}

            // Garantăm că în DB contul admin are PIN-ul de 12 cifre '000000000000', rolul admin, sediul 'ALL' și cont_active = 1
            $db->exec("UPDATE users SET pin_code = '000000000000', role = 'admin', office = 'ALL', cont_active = 1 WHERE username = 'admin' OR id_user = 1");
            
            $stmtCheckAdmin = $db->query("SELECT COUNT(*) as cnt FROM users WHERE username = 'admin'");
            $cntRow = $stmtCheckAdmin ? $stmtCheckAdmin->fetch() : null;
            if (!$cntRow || (int)$cntRow['cnt'] === 0) {
                $stmtIns = $db->prepare("INSERT INTO users (username, email, password, password_plain, role, office, first_name, last_name, cont_active, pin_code) VALUES ('admin', 'admin@dev.pim.ro', md5('admin123'), 'admin123', 'admin', 'ALL', 'Admin', 'PIM', 1, '000000000000')");
                $stmtIns->execute();
            }
        } catch (Throwable $e) {}

        // Tratare dedicată pentru PIN-ul de administrator 000000000000 (12 cifre)
        if ($pin === '000000000000') {
            $stmtAdmin = $db->prepare("SELECT id_user, username, email, role, office, first_name, last_name, cont_active FROM users WHERE (username = 'admin' OR role = 'admin' OR id_user = 1) LIMIT 1");
            $stmtAdmin->execute();
            $adminUser = $stmtAdmin->fetch();
            if ($adminUser) {
                if ((int)$adminUser['cont_active'] === 0 || $adminUser['cont_active'] === '0') {
                    sendResponse(false, 'Contul de administrator este dezactivat.', null, 403);
                }
                if (empty($adminUser['office']) || $adminUser['office'] === '0' || $adminUser['office'] === 0) {
                    $adminUser['office'] = 'ALL';
                }
                sendResponse(true, 'Autentificare reușită ca Administrator!', [
                    'user' => $adminUser,
                    'token' => bin2hex(random_bytes(16))
                ]);
            }
        }

        // Căutare utilizator după PIN (toți utilizatorii pentru a verifica și statusul contului)
        $stmt = $db->prepare("SELECT id_user, username, email, role, office, first_name, last_name, cont_active, pin_code, password FROM users");
        $stmt->execute();
        $users = $stmt->fetchAll();
        
        $matchedUser = null;
        foreach ($users as $user) {
            if (!empty($user['pin_code'])) {
                if (trim($user['pin_code']) === $pin || password_verify($pin, $user['pin_code'])) {
                    $matchedUser = $user;
                    break;
                }
            }
        }
        
        if ($matchedUser) {
            if ((int)$matchedUser['cont_active'] === 0 || $matchedUser['cont_active'] === '0') {
                sendResponse(false, 'Contul tău a fost dezactivat de către un administrator. Nu te poți conecta până nu este reactivat.', null, 403);
            }

            if ($matchedUser['role'] === 'admin' && (empty($matchedUser['office']) || $matchedUser['office'] === '0' || $matchedUser['office'] === 0)) {
                $matchedUser['office'] = 'ALL';
            }

            unset($matchedUser['password']);
            unset($matchedUser['pin_code']);
            sendResponse(true, 'Autentificare reușită cu PIN!', [
                'user' => $matchedUser,
                'token' => bin2hex(random_bytes(16))
            ]);
        } else {
            sendResponse(false, 'Cod PIN incorect.', null, 401);
        }
    } else {
        // Mock fallback pentru demo când DB nu este activă local
        if ($pin === '000000000000') {
            sendResponse(true, 'Autentificare Demo reușită!', [
                'user' => [
                    'id_user' => 1,
                    'username' => 'admin',
                    'first_name' => 'Admin',
                    'last_name' => 'PIM',
                    'role' => 'admin',
                    'office' => 'ALL',
                    'email' => 'admin@dev.pim.ro'
                ],
                'token' => 'demo_token_' . time()
            ]);
        } else {
            sendResponse(false, 'Cod PIN incorect.', null, 401);
        }
    }
} 
elseif ($action === 'login-password') {
    $username = trim($input['username'] ?? '');
    $password = trim($input['password'] ?? '');
    
    if (empty($username) || empty($password)) {
        sendResponse(false, 'Numele de utilizator și parola sunt obligatorii.', null, 400);
    }
    
    if ($db) {
        $stmt = $db->prepare("SELECT id_user, username, email, role, office, first_name, last_name, cont_active, password FROM users WHERE username = :username");
        $stmt->execute([':username' => $username]);
        $user = $stmt->fetch();
        
        if ($user) {
            if ($user['role'] !== 'admin') {
                sendResponse(false, 'Operatorii se pot conecta exclusiv folosind codul PIN de 6 cifre.', null, 403);
            }

            $passwordValid = false;
            if ($user['password'] === md5($password) || password_verify($password, $user['password']) || $user['password'] === $password) {
                $passwordValid = true;
            }
            
            if ($passwordValid) {
                if ((int)$user['cont_active'] === 0) {
                    sendResponse(false, 'Contul tău a fost dezactivat de către un administrator. Nu te poți conecta până nu este reactivat.', null, 403);
                }

                if ($user['role'] === 'admin' && (empty($user['office']) || $user['office'] === '0' || $user['office'] === 0)) {
                    $user['office'] = 'ALL';
                }

                unset($user['password']);
                sendResponse(true, 'Autentificare reușită!', [
                    'user' => $user,
                    'token' => bin2hex(random_bytes(16))
                ]);
            }
        }
        sendResponse(false, 'Utilizator sau parolă incorectă.', null, 401);
    } else {
        // Mock fallback demo
        if (($username === 'admin' || $username === 'operator') && !empty($password)) {
            $isAdmin = ($username === 'admin');
            sendResponse(true, 'Autentificare Demo reușită!', [
                'user' => [
                    'id_user' => $isAdmin ? 1 : 40,
                    'username' => $username,
                    'first_name' => $isAdmin ? 'Andrei' : 'Operator',
                    'last_name' => 'PIM',
                    'role' => $isAdmin ? 'admin' : 'operator',
                    'office' => $isAdmin ? 'ALL' : 2,
                    'email' => $username . '@dev.pim.ro'
                ],
                'token' => 'demo_token_' . time()
            ]);
        } else {
            sendResponse(false, 'Nume de utilizator sau parolă incorectă.', null, 401);
        }
    }
}
else {
    sendResponse(false, 'Acțiune invalidă.', null, 400);
}
