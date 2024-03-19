<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Endpoint\DingCallback;

class Prpcrypt
{
    public string $key;

    public function __construct(string $key)
    {
        $this->key = base64_decode($key . '=');
    }

    public function encrypt(string $text, string $suiteKey): string
    {
        $random = random_str(16);
        $text = $random . pack('N', strlen($text)) . $text . $suiteKey;
        $iv = substr($this->key, 0, 16);
        $pkcEncoder = new PKCS7Encoder();
        $text = $pkcEncoder->encode($text);
        $encrypted = openssl_encrypt($text, 'aes-256-cbc', $this->key, OPENSSL_RAW_DATA | OPENSSL_ZERO_PADDING, $iv);
        return base64_encode($encrypted);
    }

    public function decrypt(string $encrypted, string $suiteKey): string
    {
        $ciphertext = base64_decode($encrypted);
        $iv = substr($this->key, 0, 16);
        $decrypted = openssl_decrypt($ciphertext, 'aes-256-cbc', $this->key, OPENSSL_RAW_DATA | OPENSSL_ZERO_PADDING, $iv);
        $pkcEncoder = new PKCS7Encoder();
        $result = $pkcEncoder->decode($decrypted);
        $content = substr($result, 16, strlen($result));
        $lenList = unpack('N', substr($content, 0, 4));
        $xmlLen = $lenList[1];
        $xmlContent = substr($content, 4, $xmlLen);
        $formSuiteKey = substr($content, $xmlLen + 4);
        if ($formSuiteKey !== $suiteKey) {
            return '';
        }
        return $xmlContent;
    }
}
