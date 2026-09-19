<?php
require_once __DIR__ . '/config.php';
$secret = defined('DEPLOY_SECRET') ? DEPLOY_SECRET : 'pimro1_anasoft_deploy_2026';
if (($_GET['secret'] ?? '') !== $secret) {
    http_response_code(403);
    die(json_encode(['status' => 'error', 'message' => 'Unauthorized']));
}

$host = $_SERVER['HTTP_HOST'] ?? '';
$isPortal = stristr($host, 'portal.pim.ro') !== false;

if ($isPortal) {
    $repo_dir = file_exists('/home/pimro1/repositories/portal.pim.ro') ? '/home/pimro1/repositories/portal.pim.ro' : '/home/pimro1/portal.pim.ro';
    $deploy_dir = '/home/pimro1/portal.pim.ro';
    $branch = 'main';
} else {
    $repo_dir = file_exists('/home/pimro1/repositories/dev.pim.ro') ? '/home/pimro1/repositories/dev.pim.ro' : '/home/pimro1/dev.pim.ro';
    $deploy_dir = '/home/pimro1/dev.pim.ro';
    $branch = 'dev';
}

$output = [];
$cmd = "cd $repo_dir && git fetch --all 2>&1 && git checkout $branch 2>&1 && git pull origin $branch 2>&1";
if ($repo_dir !== $deploy_dir) {
    $cmd .= " && /bin/cp -R * $deploy_dir 2>&1";
}

exec($cmd, $output, $status);

header('Content-Type: application/json');
echo json_encode([
    'status' => $status === 0 ? 'success' : 'error',
    'environment' => $isPortal ? 'portal (production)' : 'dev (development)',
    'branch' => $branch,
    'output' => $output
]);
?>
