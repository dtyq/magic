<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel\Proxy;

use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\Infrastructure\Core\File\Parser\FileParser;

class FileParserProxy
{
    public function __construct(
        private AiAbilityDomainService $aiAbilityDomainService
    ) {
    }

    /**
     * 解析文件内容.
     *
     * @param string $fileUrl 文件URL地址
     * @return string 解析后的文件内容
     */
    public function parse(string $fileUrl, bool $textPreprocess = false): string
    {
        // 从数据库读取 OCR 配置
        // 配置示例（数组格式）：
        // [
        //     'providers' => [
        //         [
        //             'name' => 'Volcengine', // 火山引擎
        //             'provider' => 'Volcengine',
        //             'enable' => true,
        //             'access_key' => '',
        //             'secret_key' => '',
        //         ]
        //     ]
        // ]
        $config = $this->aiAbilityDomainService->getProviderConfig(AiAbilityCode::Ocr);
        return di(FileParser::class)->parse($fileUrl, $textPreprocess, config: $config);
    }
}
