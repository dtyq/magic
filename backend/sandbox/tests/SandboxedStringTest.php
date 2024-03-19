<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use PHPSandbox\Options\SandboxOptions;
use PHPSandbox\PHPSandbox;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 * @coversNothing
 */
class SandboxedStringTest extends TestCase
{
    public function testJsonSerialization()
    {
        $options = new SandboxOptions();

        $sandbox = new PHPSandbox($options);
        $sandbox->accessControl->whitelistFunc('json_encode');
        $sandbox->prepare('<?php $info = [\'date\', \'time\', \'foobar\']; return json_encode($info);');
        $result = $sandbox->execute();

        $this->assertSame(json_encode(['date', 'time', 'foobar']), $result);
    }
}
