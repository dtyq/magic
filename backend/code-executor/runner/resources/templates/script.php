<?php
ini_set('disable_functions', 'exec,passthru,shell_exec,system');
error_reporting(E_ALL);

function main() {
    $vars = json_decode(file_get_contents('php://stdin'), true);
    extract($vars);
    %{code}%
}

ob_start();
$result = main();
$output = ob_get_clean();

echo json_encode(compact('result', 'output'));
