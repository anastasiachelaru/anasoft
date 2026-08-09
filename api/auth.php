<?php
require_once __DIR__ . '/config.php';

$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$action = $input['action'] ?? $_GET['action'] ?? '';

$db = getDBConnection();

if ($action === 'login-pin') {
    $pin = trim($input['pin'] ?? '');
    
    if (empty($pin)) {
        sendResponse(false, 'Te rugăm să introduci codul PIN.', null, 400);
    }
    
    if ($db) {
        // Căutare utilizator după PIN (suportă PIN text sau password_verify/md5)
        $stmt = $db->prepare("SELECT id_user, username, email, role, office, first_name, last_name, cont_active, pin_code, password FROM users WHERE cont_active = 1");
        $stmt->execute();
        $users = $stmt->fetchAll();
        
        $matchedUser = null;
        foreach ($users as $user) {
            if (!empty($user['pin_code'])) {
                // Verificare potrivire exactă PIN sau verification hash
                if ($user['pin_code'] === $pin || password_verify($pin, $user['pin_code'])) {
                    $matchedUser = $user;
                    break;
                }
            }
        }
        
        if ($matchedUser) {
            unset($matchedUser['password']);
            unset($matchedUser['pin_code']);
            sendResponse(true, 'Autentificare reușită cu PIN!', [
                'user' => $matchedUser,
                'token' => bin2hex(random_bytes(16))
            ]);
        } else {
            sendResponse(false, 'Cod PIN incorect sau cont inactiv.', null, 401);
        }
    } else {
        // Mock fallback pentru demo când DB nu este activă local
        if ($pin === '123456' || $pin === '8122' || $pin === '000000') {
            $isAdmin = ($pin === '000000');
            sendResponse(true, 'Autentificare Demo reușită!', [
                'user' => [
                    'id_user' => $isAdmin ? 1 : 46,
                    'username' => $isAdmin ? 'admin' : 'liviuc',
                    'first_name' => $isAdmin ? 'Andrei' : 'Liviu',
                    'last_name' => $isAdmin ? 'Petriu' : 'C.',
                    'role' => $isAdmin ? 'admin' : 'operator',
                    'office' => 2, // Independenței
                    'email' => 'operator@pimcopy.ro'
                ],
                'token' => 'demo_token_' . time()
            ]);
        } else {
            sendResponse(false, 'PIN incorect (Incearcă 123456 pentru Angajat sau 000000 pentru Admin).', null, 401);
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
        $stmt = $db->prepare("SELECT id_user, username, email, role, office, first_name, last_name, cont_active, password FROM users WHERE username = :username AND cont_active = 1");
        $stmt->execute([':username' => $username]);
        $user = $stmt->fetch();
        
        if ($user) {
            $passwordValid = false;
            // Suport MD5 legacy din baza de date PIM + password_verify modern
            if ($user['password'] === md5($password) || password_verify($password, $user['password']) || $user['password'] === $password) {
                $passwordValid = true;
            }
            
            if ($passwordValid) {
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
                    'office' => 2,
                    'email' => $username . '@pimcopy.ro'
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
