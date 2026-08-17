<?php
require_once __DIR__ . '/config.php';

$db = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$action = $input['action'] ?? $_GET['action'] ?? 'list';

$officesMap = [
    2 => 'Independenței',
    3 => 'Tudor',
    4 => 'Tipografie',
    5 => 'Smârdan',
    6 => 'UMF 2'
];

if ($action === 'list') {
    if ($db) {
        try {
            // Asigurăm că tabela users conține coloana password_plain dacă nu există
            try {
                $db->exec("ALTER TABLE users ADD COLUMN password_plain VARCHAR(255) DEFAULT NULL");
            } catch (Throwable $e) {}

            // Setăm PIN-ul de 12 cifre de 0 pentru Admin PIM dacă e necesar
            $db->exec("UPDATE users SET pin_code = '000000000000', role = 'admin', password_plain = IF(password_plain IS NULL OR password_plain='', 'admin123', password_plain) WHERE username = 'admin' OR id_user = 1");

            // Garantăm existența contului Admin PIM
            $stmtCheckAdmin = $db->query("SELECT COUNT(*) as cnt FROM users WHERE username = 'admin'");
            $cntRow = $stmtCheckAdmin ? $stmtCheckAdmin->fetch() : null;
            if (!$cntRow || (int)$cntRow['cnt'] === 0) {
                $stmtIns = $db->prepare("INSERT INTO users (username, email, password, password_plain, role, office, first_name, last_name, cont_active, pin_code) VALUES ('admin', 'admin@pimcopy.ro', md5('admin123'), 'admin123', 'admin', 2, 'Admin', 'PIM', 1, '000000000000')");
                $stmtIns->execute();
            }

            // Garantăm existența cel puțin unui cont de operator demo dacă baza de date conține doar admin
            $stmtCheckOp = $db->query("SELECT COUNT(*) as cnt FROM users WHERE role = 'operator'");
            $opRow = $stmtCheckOp ? $stmtCheckOp->fetch() : null;
            if (!$opRow || (int)$opRow['cnt'] === 0) {
                $stmtInsOp = $db->prepare("INSERT INTO users (username, email, password, password_plain, role, office, first_name, last_name, cont_active, pin_code) VALUES ('operator', 'operator@pimcopy.ro', md5('operator123'), 'operator123', 'operator', 2, 'Operator', 'Independenței', 1, '123456')");
                $stmtInsOp->execute();
            }

            $stmt = $db->prepare("SELECT id_user, username, email, role, office, first_name, last_name, cont_active, pin_code, password, password_plain FROM users ORDER BY id_user DESC");
            $stmt->execute();
            $users = $stmt->fetchAll();
            
            foreach ($users as &$u) {
                $u['office_nume'] = $officesMap[$u['office'] ?? 2] ?? 'Independenței';
                if (empty($u['first_name']) && empty($u['last_name'])) {
                    $u['full_name'] = $u['username'];
                } else {
                    $u['full_name'] = trim(($u['first_name'] ?? '') . ' ' . ($u['last_name'] ?? ''));
                }

                if (empty($u['password_plain'])) {
                    $u['password_plain'] = !empty($u['password']) && strlen($u['password']) < 32 ? $u['password'] : ($u['role'] === 'admin' ? 'admin123' : 'operator123');
                }
            }
            
            sendResponse(true, 'Lista de utilizatori încărcată.', $users);
        } catch (Throwable $e) {
            sendResponse(false, 'Eroare preluare utilizatori: ' . $e->getMessage(), null, 200);
        }
    } else {
        // Mock data cu adminul și operatorul demo
        sendResponse(true, 'Mock utilizatori.', [
            ['id_user' => 1, 'username' => 'admin', 'role' => 'admin', 'office' => 2, 'office_nume' => 'Independenței', 'full_name' => 'Admin PIM', 'cont_active' => 1, 'pin_code' => '000000000000', 'password_plain' => 'admin123'],
            ['id_user' => 46, 'username' => 'operator', 'role' => 'operator', 'office' => 2, 'office_nume' => 'Independenței', 'full_name' => 'Operator Independenței', 'cont_active' => 1, 'pin_code' => '123456', 'password_plain' => 'operator123']
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

    // Validare lungime PIN după rol (12 cifre pentru Admin, 6 cifre pentru Operator)
    if ($role === 'admin') {
        if (empty($pin)) {
            $pin = '000000000000';
        } elseif (strlen($pin) !== 12) {
            sendResponse(false, 'Codul PIN pentru Administrator trebuie să conțină exact 12 cifre.', null, 400);
        }
    } else {
        if (empty($pin)) {
            $pin = str_pad((string)rand(100000, 999999), 6, '0', STR_PAD_LEFT);
        } elseif (strlen($pin) !== 6) {
            sendResponse(false, 'Codul PIN pentru Operator trebuie să conțină exact 6 cifre.', null, 400);
        }
    }

    $nameParts = explode(' ', $fullName, 2);
    $firstName = $nameParts[0] ?? $username;
    $lastName = $nameParts[1] ?? '';
    $email = strtolower($username) . '@pimcopy.ro';

    if ($db) {
        try {
            $stmtCheck = $db->prepare("SELECT COUNT(*) as cnt FROM users WHERE username = :u");
            $stmtCheck->execute([':u' => $username]);
            $rowCheck = $stmtCheck->fetch();
            if ($rowCheck && $rowCheck['cnt'] > 0) {
                sendResponse(false, "Numele de utilizator '{$username}' este deja utilizat.", null, 400);
            }

            $hashedPass = md5($password);

            $sql = "INSERT INTO users (username, email, password, password_plain, role, office, first_name, last_name, cont_active, pin_code) 
                    VALUES (:username, :email, :password, :password_plain, :role, :office, :first_name, :last_name, 1, :pin)";
            $stmt = $db->prepare($sql);
            $stmt->execute([
                ':username' => $username,
                ':email' => $email,
                ':password' => $hashedPass,
                ':password_plain' => $password,
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
elseif ($action === 'update') {
    $idUser = (int)($input['id_user'] ?? 0);
    $username = trim($input['username'] ?? '');
    $role = trim($input['role'] ?? 'operator');
    $office = (int)($input['office'] ?? 4);
    $password = trim($input['password'] ?? '');
    $fullName = trim($input['full_name'] ?? '');
    $pin = trim($input['pin'] ?? '');

    if ($idUser <= 0) {
        sendResponse(false, 'ID utilizator invalid.', null, 400);
    }
    if (empty($username)) {
        sendResponse(false, 'Numele de utilizator este obligatoriu.', null, 400);
    }

    if ($role === 'admin' && !empty($pin) && strlen($pin) !== 12) {
        sendResponse(false, 'Codul PIN pentru Administrator trebuie să conțină exact 12 cifre.', null, 400);
    }
    if ($role === 'operator' && !empty($pin) && strlen($pin) !== 6) {
        sendResponse(false, 'Codul PIN pentru Operator trebuie să conțină exact 6 cifre.', null, 400);
    }

    $nameParts = explode(' ', $fullName, 2);
    $firstName = $nameParts[0] ?? $username;
    $lastName = $nameParts[1] ?? '';

    if ($db) {
        try {
            $stmtCheck = $db->prepare("SELECT id_user FROM users WHERE username = :u AND id_user != :id");
            $stmtCheck->execute([':u' => $username, ':id' => $idUser]);
            if ($stmtCheck->fetch()) {
                sendResponse(false, "Numele de utilizator '{$username}' este deja utilizat de alt cont.", null, 400);
            }

            if (!empty($password)) {
                $hashedPass = md5($password);
                $sql = "UPDATE users SET username = :username, role = :role, office = :office, first_name = :first_name, last_name = :last_name, pin_code = :pin, password = :password, password_plain = :password_plain WHERE id_user = :id";
                $params = [
                    ':username' => $username,
                    ':role' => $role,
                    ':office' => $office,
                    ':first_name' => $firstName,
                    ':last_name' => $lastName,
                    ':pin' => $pin,
                    ':password' => $hashedPass,
                    ':password_plain' => $password,
                    ':id' => $idUser
                ];
            } else {
                $sql = "UPDATE users SET username = :username, role = :role, office = :office, first_name = :first_name, last_name = :last_name, pin_code = :pin WHERE id_user = :id";
                $params = [
                    ':username' => $username,
                    ':role' => $role,
                    ':office' => $office,
                    ':first_name' => $firstName,
                    ':last_name' => $lastName,
                    ':pin' => $pin,
                    ':id' => $idUser
                ];
            }

            $stmt = $db->prepare($sql);
            $stmt->execute($params);

            sendResponse(true, "Datele utilizatorului '@{$username}' au fost actualizate cu succes.");
        } catch (Throwable $e) {
            sendResponse(false, 'Eroare modificare utilizator: ' . $e->getMessage(), null, 500);
        }
    } else {
        sendResponse(true, "Date utilizator modificate (Demo).");
    }
}
elseif ($action === 'toggle-status') {
    $idUser = (int)($input['id_user'] ?? 0);
    if ($idUser <= 0) sendResponse(false, 'ID utilizator invalid.', null, 400);
    
    if ($db) {
        try {
            $stmtCheck = $db->prepare("SELECT role, username FROM users WHERE id_user = :id");
            $stmtCheck->execute([':id' => $idUser]);
            $userRow = $stmtCheck->fetch();

            if ($userRow && ($userRow['role'] === 'admin' || strtolower($userRow['username']) === 'admin')) {
                sendResponse(false, 'Conturile de administrator nu pot fi dezactivate.', null, 400);
            }

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
elseif ($action === 'delete') {
    $idUser = (int)($input['id_user'] ?? 0);
    if ($idUser <= 0) sendResponse(false, 'ID utilizator invalid.', null, 400);
    
    if ($db) {
        try {
            $stmtCheck = $db->prepare("SELECT role, username FROM users WHERE id_user = :id");
            $stmtCheck->execute([':id' => $idUser]);
            $userRow = $stmtCheck->fetch();

            if ($userRow && ($userRow['role'] === 'admin' || strtolower($userRow['username']) === 'admin')) {
                sendResponse(false, 'Conturile de administrator nu pot fi șterse.', null, 400);
            }

            $stmt = $db->prepare("DELETE FROM users WHERE id_user = :id");
            $stmt->execute([':id' => $idUser]);
            sendResponse(true, 'Contul de utilizator a fost șters definitiv din sistem.');
        } catch (Throwable $e) {
            sendResponse(false, 'Eroare ștergere utilizator: ' . $e->getMessage(), null, 500);
        }
    } else {
        sendResponse(true, 'Utilizator șters (Demo).');
    }
}
else {
    sendResponse(false, 'Acțiune invalidă.', null, 400);
}
