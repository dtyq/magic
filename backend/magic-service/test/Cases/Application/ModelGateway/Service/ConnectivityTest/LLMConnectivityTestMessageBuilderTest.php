<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\Service\ConnectivityTest;

use App\Application\ModelGateway\Service\ConnectivityTest\LLMConnectivityTestMessageBuilder;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class LLMConnectivityTestMessageBuilderTest extends TestCase
{
    public function testMultimodalImageAndMessageAreStable(): void
    {
        $dataUri = LLMConnectivityTestMessageBuilder::getMultimodalImageDataUri();
        $this->assertStringStartsWith('data:image/jpeg;base64,', $dataUri);

        $binary = base64_decode(substr($dataUri, strlen('data:image/jpeg;base64,')), true);
        $this->assertIsString($binary);
        $this->assertSame(21309, strlen($binary));
        $this->assertSame('f8091548687843e696b73f30f0046d56f7cbeb334d346515063710f39cd40415', hash('sha256', $binary));
        $this->assertSame("\xFF\xD8\xFF", substr($binary, 0, 3));

        $messages = LLMConnectivityTestMessageBuilder::buildMultimodalMessages();
        $this->assertSame('user', $messages[0]['role']);
        $this->assertSame('text', $messages[0]['content'][0]['type']);
        $this->assertSame('image_url', $messages[0]['content'][1]['type']);
        $this->assertSame($dataUri, $messages[0]['content'][1]['image_url']['url']);
    }

    public function testFunctionCallToolsContainStableConnectivityTool(): void
    {
        $tools = LLMConnectivityTestMessageBuilder::buildFunctionCallTools();

        $this->assertCount(1, $tools);
        $this->assertSame('function', $tools[0]['type']);
        $this->assertSame('get_current_time', $tools[0]['function']['name']);
        $this->assertSame('object', $tools[0]['function']['parameters']['type']);
        $this->assertArrayHasKey('timezone', $tools[0]['function']['parameters']['properties']);
    }
}
