<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel;

use App\Domain\File\Service\FileDomainService;
use App\Infrastructure\Util\File\EasyFileTools;
use Dtyq\CloudFile\Kernel\Struct\FileLink;

class SmartFileLinks
{
    public static function get(string $fileKey): ?FileLink
    {
        $fileLinks = self::list([$fileKey]);
        return $fileLinks[$fileKey] ?? null;
    }

    /**
     * @return array<string,FileLink>
     */
    public static function list(array $fileKeys = []): array
    {
        if (empty($fileKeys)) {
            return [];
        }

        $fileKeys = array_values(array_unique($fileKeys));

        // 分类组织编码 fileKey 数据
        $organizationCodeFileKeys = [];
        foreach ($fileKeys as $fileKey) {
            $formattedFileKey = EasyFileTools::formatPath($fileKey);
            if (empty($formattedFileKey)) {
                continue;
            }
            $organizationCode = explode('/', $formattedFileKey, 2)[0] ?? '';
            if (! empty($organizationCode)) {
                $organizationCodeFileKeys[$organizationCode][] = $formattedFileKey;
            }
        }

        $fileDomainService = di(FileDomainService::class);

        $result = [];
        foreach ($organizationCodeFileKeys as $organizationCode => $fileKeys) {
            $fileLinks = $fileDomainService->getLinks($organizationCode, $fileKeys);
            $result = array_merge($result, $fileLinks);
        }
        return $result;
    }
}
