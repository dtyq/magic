<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Endpoint\DingCallback;

use Dtyq\EasyDingTalk\OpenDev\Endpoint\OpenDevEndpoint;

/**
 * @see https://github.com/open-dingtalk/DingTalk-Callback-Crypto/blob/main/DingCallbackCrypto.php
 */
class DingCallbackEndpoint extends OpenDevEndpoint
{
    public function encryptMsg(DingCallbackMessage $dingCallbackMessage): void
    {
        $pc = new Prpcrypt($this->openDevConfig->getDingCallbackConfig()->getAesKey());
        $encrypt = $pc->encrypt($dingCallbackMessage->getMessage(), $this->openDevConfig->getAppKey());
        $sha1 = new SHA1();
        $signature = $sha1->getSHA1(
            $this->openDevConfig->getDingCallbackConfig()->getToken(),
            $dingCallbackMessage->getTimestamp(),
            $dingCallbackMessage->getNonce(),
            $encrypt
        );
        $dingCallbackMessage->setEncryptMessage($encrypt);
        $dingCallbackMessage->setSignature($signature);
    }

    /**
     * 解密信息.
     */
    public function decryptMsg(DingCallbackMessage $dingCallbackMessage): void
    {
        $pc = new Prpcrypt($this->openDevConfig->getDingCallbackConfig()->getAesKey());
        $sha1 = new SHA1();
        $verifySignature = $sha1->getSHA1(
            $this->openDevConfig->getDingCallbackConfig()->getToken(),
            $dingCallbackMessage->getTimestamp(),
            $dingCallbackMessage->getNonce(),
            $dingCallbackMessage->getEncryptMessage()
        );
        if ($verifySignature !== $dingCallbackMessage->getSignature()) {
            return;
        }
        $message = $pc->decrypt($dingCallbackMessage->getEncryptMessage(), $this->openDevConfig->getAppKey());
        $dingCallbackMessage->setMessage($message);
    }
}
