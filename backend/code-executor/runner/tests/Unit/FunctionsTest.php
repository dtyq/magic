<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeRunnerBwrap\Tests\Unit;

use Dtyq\CodeRunnerBwrap\StatusCode;
use Dtyq\CodeRunnerBwrap\Tests\TestCase;

use function Dtyq\CodeRunnerBwrap\env;
use function Dtyq\CodeRunnerBwrap\error;
use function Dtyq\CodeRunnerBwrap\response;
use function Dtyq\CodeRunnerBwrap\success;

/**
 * @internal
 * @coversNothing
 */
class FunctionsTest extends TestCase
{
    public function testResponse()
    {
        $result = response(StatusCode::OK, ['test' => 'data'], 'Test Message');
        $decoded = json_decode($result, true);

        $this->assertEquals(StatusCode::OK->value, $decoded['code']);
        $this->assertEquals('Test Message', $decoded['message']);
        $this->assertEquals(['test' => 'data'], $decoded['data']);
    }

    public function testSuccess()
    {
        $result = success(['test' => 'data'], 'Success Message');
        $decoded = json_decode($result, true);

        $this->assertEquals(StatusCode::OK->value, $decoded['code']);
        $this->assertEquals('Success Message', $decoded['message']);
        $this->assertEquals(['test' => 'data'], $decoded['data']);
    }

    public function testError()
    {
        $result = error(StatusCode::EXECUTE_FAILED, 'Error Message');
        $decoded = json_decode($result, true);

        $this->assertEquals(StatusCode::EXECUTE_FAILED->value, $decoded['code']);
        $this->assertEquals('Error Message', $decoded['message']);
        $this->assertEmpty($decoded['data']);
    }

    public function testEnvWithExistingVariable()
    {
        putenv('TEST_VAR=test_value');
        $this->assertEquals('test_value', env('TEST_VAR'));
        putenv('TEST_VAR'); // 清除环境变量
    }

    public function testEnvWithNonExistingVariable()
    {
        $this->assertEquals('default_value', env('NON_EXISTING_VAR', 'default_value'));
    }
}
