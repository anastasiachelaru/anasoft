<?php
require_once __DIR__ . '/config.php';

$db = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$action = $input['action'] ?? $_GET['action'] ?? 'list';

$officesMap = [
    2 => 'Independenței',
    3 => 'TUDOR',
    4 => 'TIPO',
    5 => 'SMÂRDAN',
    6 => 'UMF2'
];

if ($action === 'list') {
    if ($db) {
        try {
            $stmt = $db->prepare("SELECT id_user, username, email, role, office, first_name, last_name, cont_active, pin_code, password FROM users ORDER BY id_user DESC");
            $stmt->execute();
            $users = $stmt->fetchAll();
            
            foreach ($users as &$u) {
                $u['office_nume'] = $officesMap[$u['office']] ?? 'Necunoscut';
                if (empty($u['first_name']) && empty($u['last_name'])) {
                    $u['full_name'] = $u['username'];
                } else {
                    $u['full_name'] = trim($u['first_name'] . ' ' . $u['last_name']);
                }
            }
            
            sendResponse(true, 'Lista de utilizatori încărcată.', $users);
        } catch (Throwable $e) {
            sendResponse(false, 'Eroare preluare utilizatori: ' . $e->getMessage(), null, 200);
        }
    } else {
        // Mock data
        sendResponse(true, 'Mock utilizatori.', [
            ['id_user' => 1, 'username' => 'admin', 'role' => 'admin', 'office' => 2, 'office_nume' => 'Independenței', 'full_name' => 'Admin PIM', 'cont_active' => 1, 'pin_code' => '000000', 'password' => 'admin123'],
            ['id_user' => 46, 'username' => 'operator', 'role' => 'operator', 'office' => 2, 'office_nume' => 'Independenței', 'full_name' => 'Operator Independenței', 'cont_active' => 1, 'pin_code' => '123456', 'password' => 'operator123']
        ]);
    }
}
elseif ($action === 'create') {
    $username = trim($input['username'] ?? '');
    $role = trim($input['role'] ?? 'operator');
    $office = (int)($input['office'] ?? 4);
    $password = trim($input['password'] ?? '');
    $confirmPassword = trim($input['confirm_password'] ?? '');
    $fullName = trim($input['full_name'] ?? '');
    $pin = trim($input['pin'] ?? '');

    if (empty($username)) {
        sendResponse(false, 'Numele de utilizator este obligatoriu.', null, 400);
    }

    if (empty($password)) {
        sendResponse(false, 'Parola este obligatorie.', null, 400);
    }

    if ($password !== $confirmPassword) {
        sendResponse(false, 'Parolele introduse nu se potrivesc.', null, 400);
    }

    // Daca PIN-ul este gol, generam un PIN unic de 6 cifre
    if (empty($pin)) {
        $pin = str_pad((string)rand(100000, 999999), 6, '0', STR_PAD_LEFT);
    }

    // Nume / Prenume
    $nameParts = explode(' ', $fullName, 2);
    $firstName = $nameParts[0] ?? $username;
    $lastName = $nameParts[1] ?? '';
    $email = strtolower($username) . '@pimcopy.ro';

    if ($db) {
        try {
            // Verificam daca username-ul exista deja
            $stmtCheck = $db->prepare("SELECT COUNT(*) as cnt FROM users WHERE username = :u");
            $stmtCheck->execute([':u' => $username]);
            $rowCheck = $stmtCheck->fetch();
            if ($rowCheck && $rowCheck['cnt'] > 0) {
                sendResponse(false, "Numele de utilizator '{$username}' este deja utilizat.", null, 400);
            }

            // Hashing parola (md5 + plain fallback pentru compatibilitate cu sistemul vechi PIM)
            $hashedPass = md5($password);

            $sql = "INSERT INTO users (username, email, password, role, office, first_name, last_name, cont_active, pin_code) 
                    VALUES (:username, :email, :password, :role, :office, :first_name, :last_name, 1, :pin)";
            $stmt = $db->prepare($sql);
            $stmt->execute([
                ':username' => $username,
                ':email' => $email,
                ':password' => $hashedPass,
                ':role' => $role,
                ':office' => $office,
                ':first_name' => $firstName,
                ':last_name' => $lastName,
                ':pin' => $pin
            ]);

            $newId = $db->lastInsertId();

            sendResponse(true, "Contul pentru '{$username}' a fost creat cu succes! Cod PIN atribuit: {$pin}", [
                'id_user' => $newId,
                'username' => $username,
                'role' => $role,
                'office' => $office,
                'pin_code' => $pin
            ]);
        } catch (Throwable $e) {
            sendResponse(false, 'Eroare creare utilizator: ' . $e->getMessage(), null, 500);
        }
    } else {
        sendResponse(true, "Cont creat (Demo)! PIN: {$pin}", [
            'id_user' => rand(100, 999),
            'username' => $username,
            'role' => $role,
            'office' => $office,
            'pin_code' => $pin
        ]);
    }
}
elseif ($action === 'toggle-status') {
    $idUser = (int)($input['id_user'] ?? 0);
    if ($idUser <= 0) sendResponse(false, 'ID utilizator invalid.', null, 400);
    
    if ($db) {
        try {
            $stmt = $db->prepare("UPDATE users SET cont_active = IF(cont_active=1, 0, 1) WHERE id_user = :id");
            $stmt->execute([':id' => $idUser]);
            sendResponse(true, 'Statusul contului a fost schimbat.');
        } catch (Throwable $e) {
            sendResponse(false, 'Eroare modificare status: ' . $e->getMessage(), null, 500);
        }
    } else {
        sendResponse(true, 'Status modificat (Demo).');
    }
}
else {
    sendResponse(false, 'Acțiune invalidă.', null, 400);
}
