<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Support;

require_once __DIR__ . '/MagicTestSupportUsesDatabaseIsolation.php';

use MagicTestSupport\VideoTesting\UsesDatabaseIsolation as SharedUsesDatabaseIsolation;

trait UsesDatabaseIsolation
{
    use SharedUsesDatabaseIsolation;
}
