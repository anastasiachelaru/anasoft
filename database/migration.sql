-- =============================================================================
-- PIM Iași - Script de Migrare Bază de Date (Toner Management System)
-- =============================================================================
-- Acest script se rulează o singură dată la inițializare sau la deploy.
-- Nu se rulează la fiecare cerere HTTP!
-- =============================================================================

-- 1. Structură Tabela 'sedii' (Offices)
CREATE TABLE IF NOT EXISTS `sedii` (
  `id_office` INT(11) NOT NULL,
  `nume_sediu` VARCHAR(100) NOT NULL,
  `adresa` VARCHAR(255) DEFAULT NULL,
  `activ` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id_office`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Populare inițială sedii PIM
INSERT INTO `sedii` (`id_office`, `nume_sediu`, `activ`) VALUES
(2, 'Independenței', 1),
(3, 'Tudor', 1),
(4, 'Tipografie', 1),
(5, 'Smârdan', 1),
(6, 'UMF 2', 1)
ON DUPLICATE KEY UPDATE `nume_sediu` = VALUES(`nume_sediu`), `activ` = VALUES(`activ`);

-- 2. Structură și ajustări coloane tabela 'users'
ALTER TABLE `users` MODIFY COLUMN `pin_code` VARCHAR(255) DEFAULT NULL;
ALTER TABLE `users` MODIFY COLUMN `role` VARCHAR(50) DEFAULT 'operator';
ALTER TABLE `users` MODIFY COLUMN `office` VARCHAR(50) DEFAULT '4';
ALTER TABLE `users` MODIFY COLUMN `status` VARCHAR(20) DEFAULT 'activ';
ALTER TABLE `users` MODIFY COLUMN `cont_active` TINYINT DEFAULT 1;

-- Curățare coloană învechită password_plain
UPDATE `users` SET `password_plain` = NULL WHERE `password_plain` IS NOT NULL;

-- 3. Structură și arhivare nume operator în 'istoric_schimbari'
-- Adăugare coloană nume_operator dacă nu există
SET @exist_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'istoric_schimbari' AND COLUMN_NAME = 'nume_operator');
SET @sql_cmd = IF(@exist_col = 0, 'ALTER TABLE `istoric_schimbari` ADD COLUMN `nume_operator` VARCHAR(255) DEFAULT NULL', 'SELECT "Column nume_operator exists"');
PREPARE stmt FROM @sql_cmd;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Structură și arhivare în tabela legacy 'ink_history'
SET @exist_col2 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ink_history' AND COLUMN_NAME = 'nume_operator');
SET @sql_cmd2 = IF(@exist_col2 = 0, 'ALTER TABLE `ink_history` ADD COLUMN `nume_operator` VARCHAR(255) DEFAULT NULL', 'SELECT "Column nume_operator exists in ink_history"');
PREPARE stmt2 FROM @sql_cmd2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- Permitere NULL pe id_user în ink_history pentru a nu bloca ștergerea utilizatorilor
ALTER TABLE `ink_history` MODIFY COLUMN `id_user` INT DEFAULT NULL;

-- Asigurare status activ pentru administratorii principali
UPDATE `users` SET `role` = 'admin', `status` = 'activ', `cont_active` = 1 WHERE `username` IN ('eugenadmin', 'anastasia');

-- Normalizare valori sedii în tabela 'users'
UPDATE `users` SET `office` = 'ALL' WHERE `role` = 'admin' AND (`office` IS NULL OR `office` = '0' OR `office` = 'toate');
UPDATE `users` SET `office` = '4' WHERE `role` = 'operator' AND (`office` = 'ALL' OR `office` = '0' OR `office` IS NULL OR `office` = '');

-- 5. Indexuri de performanță pentru căutare rapidă și paginare pe istoric
SET @exist_idx1 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'istoric_schimbari' AND INDEX_NAME = 'idx_istoric_aparat');
SET @sql_idx1 = IF(@exist_idx1 = 0, 'CREATE INDEX idx_istoric_aparat ON `istoric_schimbari` (`id_aparat`)', 'SELECT "Index idx_istoric_aparat exists"');
PREPARE stmt_idx1 FROM @sql_idx1;
EXECUTE stmt_idx1;
DEALLOCATE PREPARE stmt_idx1;

SET @exist_idx2 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'istoric_schimbari' AND INDEX_NAME = 'idx_istoric_data');
SET @sql_idx2 = IF(@exist_idx2 = 0, 'CREATE INDEX idx_istoric_data ON `istoric_schimbari` (`data_schimbare`)', 'SELECT "Index idx_istoric_data exists"');
PREPARE stmt_idx2 FROM @sql_idx2;
EXECUTE stmt_idx2;
DEALLOCATE PREPARE stmt_idx2;

SET @exist_idx3 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'istoric_schimbari' AND INDEX_NAME = 'idx_istoric_toner');
SET @sql_idx3 = IF(@exist_idx3 = 0, 'CREATE INDEX idx_istoric_toner ON `istoric_schimbari` (`id_toner`)', 'SELECT "Index idx_istoric_toner exists"');
PREPARE stmt_idx3 FROM @sql_idx3;
EXECUTE stmt_idx3;
DEALLOCATE PREPARE stmt_idx3;

SET @exist_idx4 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'istoric_schimbari' AND INDEX_NAME = 'idx_istoric_user');
SET @sql_idx4 = IF(@exist_idx4 = 0, 'CREATE INDEX idx_istoric_user ON `istoric_schimbari` (`id_user`)', 'SELECT "Index idx_istoric_user exists"');
PREPARE stmt_idx4 FROM @sql_idx4;
EXECUTE stmt_idx4;
DEALLOCATE PREPARE stmt_idx4;

SET @exist_idx5 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'istoric_schimbari' AND INDEX_NAME = 'idx_istoric_aparat_data');
SET @sql_idx5 = IF(@exist_idx5 = 0, 'CREATE INDEX idx_istoric_aparat_data ON `istoric_schimbari` (`id_aparat`, `data_schimbare`)', 'SELECT "Index idx_istoric_aparat_data exists"');
PREPARE stmt_idx5 FROM @sql_idx5;
EXECUTE stmt_idx5;
DEALLOCATE PREPARE stmt_idx5;

SET @exist_idx6 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tonere' AND INDEX_NAME = 'idx_tonere_tip_office');
SET @sql_idx6 = IF(@exist_idx6 = 0, 'CREATE INDEX idx_tonere_tip_office ON `tonere` (`id_tip_toner`, `office`)', 'SELECT "Index idx_tonere_tip_office exists"');
PREPARE stmt_idx6 FROM @sql_idx6;
EXECUTE stmt_idx6;
DEALLOCATE PREPARE stmt_idx6;


