#!/usr/bin/env php
<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Contract\ApplicationInterface;
use Hyperf\Di\ClassLoader;
use Hyperf\Di\ScanHandler\ProcScanHandler;
use Hyperf\Engine\DefaultOption;
use Psr\Container\ContainerInterface;
use Symfony\Component\Console\Application;

ini_set('display_errors', 'on');
ini_set('display_startup_errors', 'on');
ini_set('memory_limit', '-1');

error_reporting(E_ALL ^ E_DEPRECATED);
date_default_timezone_set('Asia/Shanghai');

! defined('BASE_PATH') && define('BASE_PATH', dirname(__DIR__));
require BASE_PATH . '/vendor/autoload.php';
! defined('SWOOLE_HOOK_FLAGS') && define('SWOOLE_HOOK_FLAGS', DefaultOption::hookFlags());

// Self-called anonymous function that creates its own scope and keep the global namespace clean.
(static function () {
    ClassLoader::init(handler: new ProcScanHandler());
    /** @var ContainerInterface $container */
    $container = require BASE_PATH . '/config/container.php';
    /** @var Application $application */
    $application = $container->get(ApplicationInterface::class);
    $application->run();
})();
