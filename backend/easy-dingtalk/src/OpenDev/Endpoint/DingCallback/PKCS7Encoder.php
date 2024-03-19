<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Endpoint\DingCallback;

class PKCS7Encoder
{
    private int $blockSize = 32;

    public function encode(string $text): string
    {
        $textLength = strlen($text);
        $amountToPad = $this->blockSize - ($textLength % $this->blockSize);
        if ($amountToPad === 0) {
            $amountToPad = $this->blockSize;
        }
        $padChr = chr($amountToPad);
        $tmp = str_repeat($padChr, $amountToPad);
        return $text . $tmp;
    }

    public function decode(string $text)
    {
        $pad = ord(substr($text, -1));
        if ($pad < 1 || $pad > $this->blockSize) {
            $pad = 0;
        }
        return substr($text, 0, strlen($text) - $pad);
    }
}
