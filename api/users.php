<?php
require_once __DIR__ . '/config.php';

$db = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$action = $input['action'] ?? $_GET['action'] ?? 'list';

$officesMap = getOfficesMap($db);

if ($action === 'list') {
    // 1.1 Protecție sesiune/token
    $authUser = requireAuth(null, $db);

    if ($db) {
        try {
            // Asigurăm că eugenadmin și anastasia au garantat rolul de admin și status activ
            try {
                $db->exec("UPDATE users SET role = 'admin', status = 'activ', cont_active = 1 WHERE username IN ('eugenadmin', 'anastasia')");
            } catch (Throwable $e) {}

            // 1.2 Selectăm STRICT coloanele non-secrete (NU selectăm password, password_plain sau pin_code)
            $stmt = $db->prepare("SELECT id_user, username, email, role, office, first_name, last_name, cont_active, status, (CASE WHEN pin_code IS NOT NULL AND pin_code != '' THEN 1 ELSE 0 END) as has_pin FROM users ORDER BY id_user DESC");
            $stmt->execute();
            $users = $stmt->fetchAll();
            
            foreach ($users as &$u) {
                if (empty($u['status'])) {
                    $u['status'] = ((int)($u['cont_active'] ?? 1) === 1) ? 'activ' : 'inactiv';
                }
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
            }
            
            sendResponse(true, 'Lista de utilizatori încărcată.', $users);
        } catch (Throwable $e) {
            sendResponse(false, 'Eroare preluare utilizatori: ' . $e->getMessage(), null, 500);
        }
    } else {
        // Mock data pentru mediu fără bază de date (fără parole/PIN-uri expuse)
        sendResponse(true, 'Mock utilizatori.', [
            ['id_user' => 173, 'username' => 'anastasia', 'role' => 'admin', 'office' => 'ALL', 'office_nume' => 'Toate sediile PIM', 'full_name' => 'Anastasia Chelaru', 'cont_active' => 1, 'status' => 'activ', 'has_pin' => 0],
            ['id_user' => 117, 'username' => 'eugenadmin', 'role' => 'admin', 'office' => 'ALL', 'office_nume' => 'Toate sediile PIM', 'full_name' => 'Eugen Admin', 'cont_active' => 1, 'status' => 'activ', 'has_pin' => 0]
        ]);
    }
}
elseif ($action === 'create') {
    $authAdmin = requireAuth('admin', $db);

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
            $password = 'op_' . bin2hex(random_bytes(6));
            $confirmPassword = $password;
        }
    }

    // Validare lungime PIN după rol (12 cifre pentru Admin dacă este completat, 6 cifre pentru Operator)
    if ($role === 'admin') {
        if (!empty($pin) && strlen($pin) !== 12) {
            sendResponse(false, 'Codul PIN pentru Administrator trebuie să conțină exact 12 cifre.', null, 400);
        }
        if (empty($pin)) {
            $pin = null;
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
            // Verificăm dacă PIN-ul introdus aparține deja altui utilizator
            if (!empty($pin)) {
                $stmtCheckPin = $db->prepare("SELECT id_user, pin_code FROM users WHERE pin_code IS NOT NULL AND username != :u");
                $stmtCheckPin->execute([':u' => $username]);
                $existingPins = $stmtCheckPin->fetchAll();
                foreach ($existingPins as $ep) {
                    if (!empty($ep['pin_code']) && (password_verify($pin, $ep['pin_code']) || trim($ep['pin_code']) === $pin)) {
                        sendResponse(false, "Acest PIN este deja folosit de un alt utilizator, te rugăm să alegi altul.", null, 400);
                    }
                }
            }

            // Verificăm dacă numele de utilizator există deja
            $stmtCheck = $db->prepare("SELECT id_user FROM users WHERE username = :u");
            $stmtCheck->execute([':u' => $username]);
            $existingUser = $stmtCheck->fetch();

            $hashedPassword = !empty($password) ? password_hash($password, PASSWORD_DEFAULT) : null;
            $hashedPin = !empty($pin) ? password_hash($pin, PASSWORD_DEFAULT) : null;

            if ($existingUser) {
                $sql = "UPDATE users SET email = :email, password = :password, password_plain = NULL, role = :role, office = :office, first_name = :first_name, last_name = :last_name, cont_active = 1, status = 'activ', pin_code = :pin WHERE id_user = :id";
                $stmt = $db->prepare($sql);
                $stmt->execute([
                    ':email' => $email,
                    ':password' => $hashedPassword,
                    ':role' => $role,
                    ':office' => $office,
                    ':first_name' => $firstName,
                    ':last_name' => $lastName,
                    ':pin' => $hashedPin,
                    ':id' => $existingUser['id_user']
                ]);
                $newId = $existingUser['id_user'];
            } else {
                $sql = "INSERT INTO users (username, email, password, password_plain, role, office, first_name, last_name, cont_active, status, pin_code) 
                        VALUES (:username, :email, :password, NULL, :role, :office, :first_name, :last_name, 1, 'activ', :pin)";
                $stmt = $db->prepare($sql);
                $stmt->execute([
                    ':username' => $username,
                    ':email' => $email,
                    ':password' => $hashedPassword,
                    ':role' => $role,
                    ':office' => $office,
                    ':first_name' => $firstName,
                    ':last_name' => $lastName,
                    ':pin' => $hashedPin
                ]);
                $newId = $db->lastInsertId();
            }

            $successMsg = ($role === 'admin') 
                ? "Contul de administrator pentru '{$username}' a fost salvat cu succes!" 
                : "Contul pentru '{$username}' a fost salvat cu succes! Cod PIN atribuit: {$pin}";

            sendResponse(true, $successMsg, [
                'id_user' => (int)$newId,
                'username' => $username,
                'role' => $role,
                'office' => $office,
                'status' => 'activ'
            ]);
        } catch (Throwable $e) {
            sendResponse(false, 'Eroare salvare utilizator: ' . $e->getMessage(), null, 500);
        }
    } else {
        sendResponse(true, "Cont creat (Demo)!", [
            'id_user' => rand(100, 999),
            'username' => $username,
            'role' => $role,
            'office' => $office,
            'status' => 'activ'
        ]);
    }
}
elseif ($action === 'update') {
    $authAdmin = requireAuth('admin', $db);

    $idUser = (int)($input['id_user'] ?? 0);
    $username = trim($input['username'] ?? '');
    $role = trim($input['role'] ?? 'operator');
    $rawOffice = trim((string)($input['office'] ?? '4'));
    $uNameLower = strtolower($username);
    if (in_array($uNameLower, ['eugenadmin', 'anastasia'])) {
        $role = 'admin';
    }
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
                sendResponse(false, "Numele de utilizator '{$username}' este deja utilizat de un alt cont.", null, 400);
            }

            // Verificăm dacă PIN-ul introdus este deja utilizat de un alt cont
            if (!empty($pin)) {
                $stmtCheckPin = $db->prepare("SELECT id_user, pin_code FROM users WHERE pin_code IS NOT NULL AND id_user != :id");
                $stmtCheckPin->execute([':id' => $idUser]);
                $existingPins = $stmtCheckPin->fetchAll();
                foreach ($existingPins as $ep) {
                    if (!empty($ep['pin_code']) && (password_verify($pin, $ep['pin_code']) || trim($ep['pin_code']) === $pin)) {
                        sendResponse(false, "Acest PIN este deja folosit de un alt utilizator, te rugăm să alegi altul.", null, 400);
                    }
                }
            }

            $updateFields = [
                'username = :username',
                'role = :role',
                'office = :office',
                'first_name = :first_name',
                'last_name = :last_name'
            ];
            $params = [
                ':username' => $username,
                ':role' => $role,
                ':office' => $office,
                ':first_name' => $firstName,
                ':last_name' => $lastName,
                ':id' => $idUser
            ];

            if (!empty($password)) {
                $hashedPass = password_hash($password, PASSWORD_DEFAULT);
                $updateFields[] = 'password = :password';
                $updateFields[] = 'password_plain = NULL';
                $params[':password'] = $hashedPass;
            }

            if (!empty($pin)) {
                $hashedPin = password_hash($pin, PASSWORD_DEFAULT);
                $updateFields[] = 'pin_code = :pin';
                $params[':pin'] = $hashedPin;
            }

            $sql = "UPDATE users SET " . implode(', ', $updateFields) . " WHERE id_user = :id";
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
    $authAdmin = requireAuth('admin', $db);

    $idUser = (int)($input['id_user'] ?? 0);
    if ($idUser <= 0) sendResponse(false, 'ID utilizator invalid.', null, 400);
    
    if ($db) {
        try {
            $stmtCheck = $db->prepare("SELECT id_user, role, username, status, cont_active FROM users WHERE id_user = :id");
            $stmtCheck->execute([':id' => $idUser]);
            $userRow = $stmtCheck->fetch();

            $uNameLower = strtolower(trim($userRow['username'] ?? ''));
            if ($userRow && in_array($uNameLower, ['eugenadmin', 'anastasia'])) {
                sendResponse(false, "Contul de administrator (@{$userRow['username']}) este protejat și nu poate fi dezactivat.", null, 400);
            }

            $currentStatus = $userRow['status'] ?? ((int)($userRow['cont_active'] ?? 1) === 1 ? 'activ' : 'inactiv');
            $newStatus = ($currentStatus === 'activ') ? 'inactiv' : 'activ';
            $newContActive = ($newStatus === 'activ') ? 1 : 0;

            $stmt = $db->prepare("UPDATE users SET status = :st, cont_active = :ca WHERE id_user = :id");
            $stmt->execute([':st' => $newStatus, ':ca' => $newContActive, ':id' => $idUser]);
            sendResponse(true, "Statusul contului a fost schimbat în '{$newStatus}'.", ['new_status' => $newStatus]);
        } catch (Throwable $e) {
            sendResponse(false, 'Eroare modificare status: ' . $e->getMessage(), null, 500);
        }
    } else {
        sendResponse(true, 'Status modificat (Demo).');
    }
}
elseif ($action === 'delete') {
    $authAdmin = requireAuth('admin', $db);

    $idUser = (int)($input['id_user'] ?? 0);
    $loggedUserId = (int)($authAdmin['id_user'] ?? 0);
    $loggedUsername = trim(strtolower($authAdmin['username'] ?? ''));

    if ($idUser <= 0) {
        sendResponse(false, 'ID utilizator invalid.', null, 400);
    }
    
    if ($db) {
        try {
            $stmtCheck = $db->prepare("SELECT id_user, role, username, first_name, last_name FROM users WHERE id_user = :id");
            $stmtCheck->execute([':id' => $idUser]);
            $userRow = $stmtCheck->fetch();

            if (!$userRow) {
                sendResponse(false, 'Utilizatorul nu a fost găsit în baza de date.', null, 404);
            }

            // 1. Protejarea conturilor principale de Administrator (eugenadmin și anastasia)
            $uNameLower = strtolower(trim($userRow['username'] ?? ''));
            if (in_array($uNameLower, ['eugenadmin', 'anastasia'])) {
                sendResponse(false, "Contul de administrator (@{$userRow['username']}) este protejat și nu poate fi șters.", null, 400);
            }

            // 2. Administratorul conectat nu își poate șterge propriul cont
            if (($loggedUserId > 0 && (int)$userRow['id_user'] === $loggedUserId) || 
                (!empty($loggedUsername) && $uNameLower === $loggedUsername)) {
                sendResponse(false, 'Nu îți poți șterge propriul cont pe care ești conectat în prezent.', null, 400);
            }

            // 3. Integritate bazei de date: Salvăm numele operatorului în tabelele de istoric (istoric_schimbari și ink_history)
            $firstName = trim($userRow['first_name'] ?? '');
            $lastName = trim($userRow['last_name'] ?? '');
            $fullName = trim($firstName . ' ' . $lastName);
            if (empty($fullName)) {
                $fullName = $userRow['username'];
            }

            try {
                $db->exec("ALTER TABLE istoric_schimbari ADD COLUMN nume_operator VARCHAR(255) DEFAULT NULL");
            } catch (Throwable $e) {}

            try {
                $db->exec("ALTER TABLE ink_history ADD COLUMN nume_operator VARCHAR(255) DEFAULT NULL");
            } catch (Throwable $e) {}

            try {
                $db->exec("ALTER TABLE ink_history MODIFY COLUMN id_user INT DEFAULT NULL");
            } catch (Throwable $e) {}

            try {
                $stmtHist = $db->prepare("UPDATE istoric_schimbari SET nume_operator = :name, id_user = NULL WHERE id_user = :id");
                $stmtHist->execute([':name' => $fullName, ':id' => $idUser]);
            } catch (Throwable $e) {}

            try {
                $stmtInk = $db->prepare("UPDATE ink_history SET nume_operator = :name, id_user = NULL WHERE id_user = :id");
                $stmtInk->execute([':name' => $fullName, ':id' => $idUser]);
            } catch (Throwable $e) {}

            // 4. Ștergerea din tabela users cu protecție temporară împotriva constrângerilor de FK din tabele vechi
            try {
                $db->exec("SET FOREIGN_KEY_CHECKS = 0");
                $stmt = $db->prepare("DELETE FROM users WHERE id_user = :id");
                $stmt->execute([':id' => $idUser]);
                $db->exec("SET FOREIGN_KEY_CHECKS = 1");
            } catch (Throwable $eDel) {
                try { $db->exec("SET FOREIGN_KEY_CHECKS = 1"); } catch (Throwable $e2) {}
                throw $eDel;
            }

            sendResponse(true, "Contul de utilizator '@{$userRow['username']}' a fost șters cu succes.");
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
