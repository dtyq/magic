<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeExecutor\Tests\Unit;

use Dtyq\CodeExecutor\ExecutionRequest;
use Dtyq\CodeExecutor\Language;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 * @coversNothing
 */
class ExecutionRequestTest extends TestCase
{
    public function testGetLanguage(): void
    {
        $request = new ExecutionRequest(Language::PHP, '<?php echo "Hello";');
        $this->assertSame(Language::PHP, $request->getLanguage());
    }

    public function testGetCode(): void
    {
        $code = '<?php echo "Hello";';
        $request = new ExecutionRequest(Language::PHP, $code);
        $this->assertSame($code, $request->getCode());
    }

    public function testGetArgs(): void
    {
        $args = ['name' => 'World'];
        $request = new ExecutionRequest(Language::PHP, '<?php echo "Hello";', $args);
        $this->assertSame($args, $request->getArgs());
    }

    public function testGetTimeout(): void
    {
        $timeout = 60;
        $request = new ExecutionRequest(Language::PHP, '<?php echo "Hello";', [], $timeout);
        $this->assertSame($timeout, $request->getTimeout());
    }

    public function testDefaultValues(): void
    {
        $request = new ExecutionRequest(Language::PHP, '<?php echo "Hello";');
        $this->assertSame([], $request->getArgs());
        $this->assertSame(30, $request->getTimeout());
    }
}
