<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest;

use PHPSandbox\Options\SandboxOptions;
use PHPSandbox\PHPSandbox;
use PHPUnit\Framework\TestCase;
use Throwable;

/**
 * @internal
 * @coversNothing
 */
class RuntimeProxyTest extends TestCase
{
    /**
     * @throws Throwable
     */
    public function testNormalizeHandlesNestedArrays()
    {
        $options = new SandboxOptions();
        $sandbox = new PHPSandbox($options);
        $options->definitions()->defineFunc('get_list', fn ($list) => $list);

        $sandbox->prepare('<?php return get_list(["time", ["exec" => "date", "time" => ["system", "passthru"]], "foo", "bar"]);');
        $this->assertSame(['time', ['exec' => 'date', 'time' => ['system', 'passthru']], 'foo', 'bar'], $sandbox->execute());
    }
}
