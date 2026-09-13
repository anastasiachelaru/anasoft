<?php
require_once __DIR__ . '/config.php';

$db = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$action = $input['action'] ?? $_GET['action'] ?? 'list';

$officesMap = [
    'ALL' => 'Toate sediile PIM',
    2 => 'Independenței',
    3 => 'Tudor',
    4 => 'Tipografie',
    5 => 'Smârdan',
    6 => 'UMF 2'
];

function ensureUsersSchema($db) {
    if (!$db) return;
    $queries = [
        "ALTER TABLE users ADD COLUMN password_plain VARCHAR(255) DEFAULT NULL",
        "ALTER TABLE users ADD COLUMN pin_code VARCHAR(32) DEFAULT NULL",
        "ALTER TABLE users MODIFY COLUMN pin_code VARCHAR(32) DEFAULT NULL",
        "ALTER TABLE users ADD COLUMN email VARCHAR(255) DEFAULT NULL",
        "ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'operator'",
        "ALTER TABLE users ADD COLUMN office VARCHAR(50) DEFAULT '4'",
        "ALTER TABLE users MODIFY COLUMN office VARCHAR(50) DEFAULT '4'",
        "ALTER TABLE users ADD COLUMN first_name VARCHAR(100) DEFAULT NULL",
        "ALTER TABLE users ADD COLUMN last_name VARCHAR(100) DEFAULT NULL",
        "ALTER TABLE users ADD COLUMN cont_active TINYINT DEFAULT 1"
    ];
    foreach ($queries as $q) {
        try {
            $db->exec($q);
        } catch (Throwable $e) {}
    }
}

if ($db) {
    ensureUsersSchema($db);
}

if ($action === 'list') {
    if ($db) {
        try {
            // Setăm PIN-ul de 12 cifre de zero (000000000000) și sediul 'ALL' pentru Admin PIM
            $db->exec("UPDATE users SET pin_code = '000000000000', role = 'admin', office = 'ALL', password = md5('admin123'), password_plain = 'admin123' WHERE username = 'admin' OR id_user = 1");

            // Garantăm existența contului Admin PIM
            $stmtCheckAdmin = $db->query("SELECT COUNT(*) as cnt FROM users WHERE username = 'admin'");
            $cntRow = $stmtCheckAdmin ? $stmtCheckAdmin->fetch() : null;
            if (!$cntRow || (int)$cntRow['cnt'] === 0) {
                $stmtIns = $db->prepare("INSERT INTO users (username, email, password, password_plain, role, office, first_name, last_name, cont_active, pin_code) VALUES ('admin', 'admin@dev.pim.ro', md5('admin123'), 'admin123', 'admin', 'ALL', 'Admin', 'PIM', 1, '000000000000')");
                $stmtIns->execute();
            }

            $stmt = $db->prepare("SELECT id_user, username, email, role, office, first_name, last_name, cont_active, pin_code, password, password_plain FROM users ORDER BY id_user DESC");
            $stmt->execute();
            $users = $stmt->fetchAll();
            
            foreach ($users as &$u) {
                $offVal = $u['office'] ?? null;
                if ($offVal === 'ALL' || $offVal === 'all' || $offVal === 'toate' || $offVal === '0' || $offVal === 0 || empty($offVal)) {
                    if ($u['role'] === 'admin') {
                        $u['office'] = 'ALL';
                        $u['office_nume'] = 'Toate sediile PIM';
                    } else {
                        $u['office'] = 4;
                        $u['office_nume'] = 'Tipografie';
                    }
                } else {
                    $u['office_nume'] = $officesMap[$u['office']] ?? ($officesMap[(int)$u['office']] ?? 'Independenței');
                }

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
        // Mock data cu singurul admin de test (PIN 12 de 0)
        sendResponse(true, 'Mock utilizatori.', [
            ['id_user' => 1, 'username' => 'admin', 'role' => 'admin', 'office' => 'ALL', 'office_nume' => 'Toate sediile PIM', 'full_name' => 'Admin PIM', 'cont_active' => 1, 'pin_code' => '000000000000', 'password_plain' => 'admin123']
        ]);
    }
}
elseif ($action === 'create') {
    $username = trim($input['username'] ?? '');
    $role = trim($input['role'] ?? 'operator');
    $rawOffice = trim((string)($input['office'] ?? '4'));
    if ($role === 'admin') {
        if ($rawOffice === 'ALL' || $rawOffice === 'all' || $rawOffice === '0' || $rawOffice === 'toate' || empty($rawOffice)) {
            $office = 'ALL';
        } else {
            $office = $rawOffice;
        }
    } else {
        if ($rawOffice === 'ALL' || $rawOffice === 'all' || $rawOffice === '0' || $rawOffice === 'toate' || empty($rawOffice)) {
            sendResponse(false, 'Pentru Operatori este obligatorie alegerea unui singur sediu fizic.', null, 400);
        }
        $office = $rawOffice;
    }
    $password = trim($input['password'] ?? '');
    $confirmPassword = trim($input['confirm_password'] ?? '');
    $fullName = trim($input['full_name'] ?? '');
    $pin = trim($input['pin'] ?? '');

    if (empty($username)) {
        sendResponse(false, 'Numele de utilizator este obligatoriu.', null, 400);
    }

    if ($role === 'admin') {
        if (empty($password)) {
            sendResponse(false, 'Parola este obligatorie pentru Administrator.', null, 400);
        }
        if ($password !== $confirmPassword) {
            sendResponse(false, 'Parolele introduse nu se potrivesc.', null, 400);
        }
    } else {
        if (empty($password)) {
            $password = 'op_' . bin2hex(random_bytes(4));
            $confirmPassword = $password;
        }
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
    $email = strtolower($username) . '@dev.pim.ro';

    if ($db) {
        try {
            // Asigurăm că pin_code permite 32 caractere
            try {
                $db->exec("ALTER TABLE users MODIFY COLUMN pin_code VARCHAR(32) DEFAULT NULL");
            } catch (Throwable $e) {}

            // Verificăm dacă PIN-ul introdus aparține deja altui utilizator
            if (!empty($pin)) {
                $stmtCheckPin = $db->prepare("SELECT id_user FROM users WHERE pin_code = :pin AND username != :u");
                $stmtCheckPin->execute([':pin' => $pin, ':u' => $username]);
                if ($stmtCheckPin->fetch()) {
                    sendResponse(false, "Acest PIN este deja folosit de un alt utilizator, te rugăm să alegi altul.", null, 200);
                }
            }

            // Verificăm dacă parola introdusă aparține deja altui utilizator
            if (!empty($password)) {
                $hashedPass = md5($password);
                $stmtCheckPass = $db->prepare("SELECT id_user FROM users WHERE (password_plain = :p1 OR password = :h OR password = :p2) AND username != :u");
                $stmtCheckPass->execute([':p1' => $password, ':h' => $hashedPass, ':p2' => $password, ':u' => $username]);
                if ($stmtCheckPass->fetch()) {
                    sendResponse(false, "Această parolă este deja folosită de un alt utilizator, te rugăm să alegi alta.", null, 200);
                }
            }

            // Verificăm dacă numele de utilizator există deja
            $stmtCheck = $db->prepare("SELECT id_user FROM users WHERE username = :u");
            $stmtCheck->execute([':u' => $username]);
            $existingUser = $stmtCheck->fetch();

            if ($existingUser) {
                $sql = "UPDATE users SET email = :email, password = :password, password_plain = :password_plain, role = :role, office = :office, first_name = :first_name, last_name = :last_name, cont_active = 1, pin_code = :pin WHERE id_user = :id";
                $stmt = $db->prepare($sql);
                $stmt->execute([
                    ':email' => $email,
                    ':password' => md5($password),
                    ':password_plain' => $password,
                    ':role' => $role,
                    ':office' => $office,
                    ':first_name' => $firstName,
                    ':last_name' => $lastName,
                    ':pin' => $pin,
                    ':id' => $existingUser['id_user']
                ]);
                $newId = $existingUser['id_user'];
            } else {
                $sql = "INSERT INTO users (username, email, password, password_plain, role, office, first_name, last_name, cont_active, pin_code) 
                        VALUES (:username, :email, :password, :password_plain, :role, :office, :first_name, :last_name, 1, :pin)";
                $stmt = $db->prepare($sql);
                $stmt->execute([
                    ':username' => $username,
                    ':email' => $email,
                    ':password' => md5($password),
                    ':password_plain' => $password,
                    ':role' => $role,
                    ':office' => $office,
                    ':first_name' => $firstName,
                    ':last_name' => $lastName,
                    ':pin' => $pin
                ]);
                $newId = $db->lastInsertId();
            }

            sendResponse(true, "Contul pentru '{$username}' a fost salvat cu succes! Cod PIN atribuit: {$pin}", [
                'id_user' => $newId,
                'username' => $username,
                'role' => $role,
                'office' => $office,
                'pin_code' => $pin
            ]);
        } catch (Throwable $e) {
            sendResponse(false, 'Eroare salvare utilizator: ' . $e->getMessage(), null, 200);
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
    $rawOffice = trim((string)($input['office'] ?? '4'));
    if ($role === 'admin') {
        if ($rawOffice === 'ALL' || $rawOffice === 'all' || $rawOffice === '0' || $rawOffice === 'toate' || empty($rawOffice)) {
            $office = 'ALL';
        } else {
            $office = $rawOffice;
        }
    } else {
        if ($rawOffice === 'ALL' || $rawOffice === 'all' || $rawOffice === '0' || $rawOffice === 'toate' || empty($rawOffice)) {
            sendResponse(false, 'Pentru Operatori este obligatorie alegerea unui singur sediu fizic.', null, 400);
        }
        $office = $rawOffice;
    }
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
                sendResponse(false, "Numele de utilizator '{$username}' este deja utilizat de un alt cont.", null, 200);
            }

            // Verificăm dacă PIN-ul introdus este deja utilizat de un alt cont
            if (!empty($pin)) {
                $stmtCheckPin = $db->prepare("SELECT id_user FROM users WHERE pin_code = :pin AND id_user != :id");
                $stmtCheckPin->execute([':pin' => $pin, ':id' => $idUser]);
                if ($stmtCheckPin->fetch()) {
                    sendResponse(false, "Acest PIN este deja folosit de un alt utilizator, te rugăm să alegi altul.", null, 200);
                }
            }

            // Verificăm dacă parola introdusă este deja utilizată de un alt cont
            if (!empty($password)) {
                $hashedPass = md5($password);
                $stmtCheckPass = $db->prepare("SELECT id_user FROM users WHERE (password_plain = :p1 OR password = :h OR password = :p2) AND id_user != :id");
                $stmtCheckPass->execute([':p1' => $password, ':h' => $hashedPass, ':p2' => $password, ':id' => $idUser]);
                if ($stmtCheckPass->fetch()) {
                    sendResponse(false, "Această parolă este deja folosită de un alt utilizator, te rugăm să alegi alta.", null, 200);
                }
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
            sendResponse(false, 'Eroare modificare utilizator: ' . $e->getMessage(), null, 200);
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
            sendResponse(false, 'Eroare modificare status: ' . $e->getMessage(), null, 200);
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
            sendResponse(false, 'Eroare ștergere utilizator: ' . $e->getMessage(), null, 200);
        }
    } else {
        sendResponse(true, 'Utilizator șters (Demo).');
    }
}
else {
    sendResponse(false, 'Acțiune invalidă.', null, 400);
}
