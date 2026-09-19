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
            $db->exec("ALTER TABLE users MODIFY COLUMN pin_code VARCHAR(32) DEFAULT NULL");
        } catch (Throwable $e) {}

        // Căutare utilizator după PIN (toți utilizatorii pentru a verifica și statusul contului)
        $stmt = $db->prepare("SELECT id_user, username, email, role, office, first_name, last_name, cont_active, status, pin_code, password FROM users");
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
            $userStatus = $matchedUser['status'] ?? ((int)$matchedUser['cont_active'] === 1 ? 'activ' : 'inactiv');
            if ($userStatus === 'inactiv' || (int)$matchedUser['cont_active'] === 0 || $matchedUser['cont_active'] === '0') {
                sendResponse(false, 'Cont inactiv sau inexistent. Vă rugăm să contactați un administrator.', null, 403);
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

            $passwordValid = false;
            if ($user['password'] === md5($password) || password_verify($password, $user['password']) || $user['password'] === $password) {
                $passwordValid = true;
            }
            
            if ($passwordValid) {
                $userStatus = $user['status'] ?? ((int)$user['cont_active'] === 1 ? 'activ' : 'inactiv');
                if ($userStatus === 'inactiv' || (int)$user['cont_active'] === 0) {
                    sendResponse(false, 'Cont inactiv sau inexistent. Vă rugăm să contactați un administrator.', null, 403);
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
else {
    sendResponse(false, 'Acțiune invalidă.', null, 400);
}
