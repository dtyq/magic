<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Endpoint\DingCallback;

class SHA1
{
    public function getSHA1(string $token, string $timestamp, string $nonce, string $encrypt_msg): string
    {
        $array = [$encrypt_msg, $token, $timestamp, $nonce];
        sort($array, SORT_STRING);
        $str = implode($array);
        return sha1($str);
    }
}
