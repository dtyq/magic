<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Composer\Autoload\ClassLoader;

/** 纯单元测试入口，不启动应用、不加载身份或访问数据库。 */
$basePath = dirname(__DIR__);
$autoload = getenv('MAGIC_UNIT_AUTOLOAD') ?: $basePath . '/vendor/autoload.php';
if (! is_file($autoload)) {
    throw new RuntimeException('请先准备测试依赖，或显式指定MAGIC_UNIT_AUTOLOAD。');
}
require $autoload;
// 本需求源码优先于外部依赖目录的优化classmap，避免测试到其他检出。
$loader = new ClassLoader();
$loader->addPsr4('App\\', $basePath . '/app', true);
$loader->addPsr4('HyperfTest\\', __DIR__, true);
$loader->register(true);

require_once $basePath . '/app/Infrastructure/Util/Functions/functions.php';
