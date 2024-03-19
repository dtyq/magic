<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\Test\OpenDev\Provider\DingCallback;

use Dtyq\EasyDingTalk\OpenDev\Endpoint\DingCallback\DingCallbackMessage;
use Dtyq\EasyDingTalk\Test\OpenDev\OpenDevEndpointBaseTestCase;

/**
 * @internal
 * @coversNothing
 */
class DingCallbackEndpointTestEndpoint extends OpenDevEndpointBaseTestCase
{
    public function testValidate()
    {
        $text = 'success';

        $openDev = $this->createOpenDevFactory('crop');
        $message = new DingCallbackMessage();
        $message->setMessage($text);
        $openDev->dingCallbackEndpoint->encryptMsg($message);
        $this->assertNotEmpty($message->getEncryptMessage());

        $message->setMessage('');
        $this->assertEmpty($message->getMessage());
        $openDev->dingCallbackEndpoint->decryptMsg($message);
        $this->assertEquals($text, $message->getMessage());
    }
}
