<?php

declare(strict_types=1);

/**
 * This file is part of Dtyq.
 */
use Dtyq\CodeRunnerBwrap\Server;
use Hyperf\Codec\Json;

use function Dtyq\CodeRunnerBwrap\env;

require_once __DIR__ . '/../vendor/autoload.php';

$server = new Server(
    '0.0.0.0',
    intval(env('SERVER_PORT', 9000)),
    options: [
        'worker_num' => intval(env('WORKER_NUM', 4)),
        'task_worker_num' => intval(env('TASK_WORKER_NUM', 10)),
        'task_max_request' => intval(env('TASK_MAX_REQUEST', 100)),
    ],
    runtimeOptions: Json::decode(env('RUNTIME_OPTIONS', '{}')) + [
        'script_tpl_path' => __DIR__ . '/../resources/templates',
    ],
);

$server->run();
