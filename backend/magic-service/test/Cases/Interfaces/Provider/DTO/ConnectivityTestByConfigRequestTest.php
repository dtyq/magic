<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\Provider\DTO;

use App\Interfaces\Provider\DTO\ConnectivityTestByConfigRequest;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ConnectivityTestByConfigRequestTest extends TestCase
{
    public function testSupportMultiModalKeepsNullWhenMissing(): void
    {
        $request = new ConnectivityTestByConfigRequest();

        $this->assertNull($request->getSupportMultiModal());
    }

    public function testSupportMultiModalParsesCommonBooleanValues(): void
    {
        $request = new ConnectivityTestByConfigRequest();

        $request->setSupportMultiModal('true');
        $this->assertTrue($request->getSupportMultiModal());

        $request->setSupportMultiModal(0);
        $this->assertFalse($request->getSupportMultiModal());

        $request->setSupportMultiModal(null);
        $this->assertNull($request->getSupportMultiModal());
    }

    public function testSupportFunctionKeepsNullWhenMissing(): void
    {
        $request = new ConnectivityTestByConfigRequest();

        $this->assertNull($request->getSupportFunction());
    }

    public function testSupportFunctionParsesCommonBooleanValues(): void
    {
        $request = new ConnectivityTestByConfigRequest();

        $request->setSupportFunction('true');
        $this->assertTrue($request->getSupportFunction());

        $request->setSupportFunction(0);
        $this->assertFalse($request->getSupportFunction());

        $request->setSupportFunction(null);
        $this->assertNull($request->getSupportFunction());
    }
}
