<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
// Isolated tests supply their own containers and databases. Do not boot the
// application bootstrap, which may create authentication records in a database.
error_reporting(E_ALL & ~E_DEPRECATED);
date_default_timezone_set('Asia/Shanghai');
! defined('BASE_PATH') && define('BASE_PATH', dirname(__DIR__));
! defined('UNIT_TEST') && define('UNIT_TEST', true);
! defined('UNIT_TESTING_ENV') && define('UNIT_TESTING_ENV', true);
require BASE_PATH . '/vendor/autoload.php';
