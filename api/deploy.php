<?php
$secret = 'pimro1_anasoft_deploy_2026';
if (($_GET['secret'] ?? '') !== $secret) {
    http_response_code(403);
    die(json_encode(['status' => 'error', 'message' => 'Unauthorized']));
}

$repo_dir = '/home/pimro1/repositories/dev.pim.ro';
$deploy_dir = '/home/pimro1/public_html/dev.pim.ro';

$output = [];
$cmd = "cd $repo_dir && git pull origin main 2>&1 && /bin/cp -R * $deploy_dir 2>&1";
exec($cmd, $output, $status);

header('Content-Type: application/json');
echo json_encode(['status' => $status === 0 ? 'success' : 'error', 'output' => $output]);
?>
