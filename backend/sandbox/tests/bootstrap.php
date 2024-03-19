<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Context\ApplicationContext;
use Hyperf\Di\ClassLoader;
use Hyperf\Di\Container;
use Hyperf\Di\Definition\DefinitionSourceFactory;
use Swoole\Runtime;

require_once dirname(dirname(__FILE__)) . '/vendor/autoload.php';

! defined('BASE_PATH') && define('BASE_PATH', dirname(__DIR__, 1));
! defined('BASE_MOCK_PATH') && define('BASE_MOCK_PATH', dirname(__DIR__, 1) . '/tests/Mock');
if (extension_loaded('swoole')) {
    ! defined('SWOOLE_HOOK_FLAGS') && define('SWOOLE_HOOK_FLAGS', SWOOLE_HOOK_ALL);
    Runtime::enableCoroutine(true);
}

ClassLoader::init(null, BASE_MOCK_PATH . '/App/config/');

$container = new Container((new DefinitionSourceFactory())());
ApplicationContext::setContainer($container);

// $dependenciesPath = include BASE_MOCK_PATH . '/App/config/autoload/dependencies.php';
// foreach ($dependenciesPath as $key => $value) {
//    $container->define($key, $value);
// }
