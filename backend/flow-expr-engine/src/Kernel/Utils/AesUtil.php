<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Kernel\Utils;

class AesUtil
{
    public static function encode(string $key, string $str): string
    {
        return openssl_encrypt($str, 'AES-256-ECB', $key);
    }

    public static function decode(string $key, string $str): string
    {
        return openssl_decrypt($str, 'AES-256-ECB', $key);
    }
}
