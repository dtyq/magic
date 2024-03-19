<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Contract\ApplicationInterface;
use Hyperf\Di\ClassLoader;
use Hyperf\Di\ScanHandler\ProcScanHandler;

error_reporting(E_ALL ^ E_DEPRECATED);
date_default_timezone_set('Asia/Shanghai');

! defined('BASE_PATH') && define('BASE_PATH', dirname(__DIR__, 1));
! defined('SWOOLE_HOOK_FLAGS') && define('SWOOLE_HOOK_FLAGS', 0);
const UNIT_TEST = true;
! defined('UNIT_TESTING_ENV') && define('UNIT_TESTING_ENV', true);

require BASE_PATH . '/vendor/autoload.php';

ClassLoader::init(handler: new ProcScanHandler());

$container = require BASE_PATH . '/config/container.php';

$container->get(ApplicationInterface::class);
