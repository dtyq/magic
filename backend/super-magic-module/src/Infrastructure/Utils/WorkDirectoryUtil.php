<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

use Dtyq\SuperMagic\Domain\SuperAgent\Constant\AgentConstant;

class WorkDirectoryUtil
{
    public static function generateWorkDir(string $userId, int $projectId): string
    {
        return sprintf('/%s/%s/project_%d', AgentConstant::SUPER_MAGIC_CODE, $userId, $projectId);
    }

    public static function getRelativeFilePath(string $fileKey, string $workDir): string
    {
        if (! empty($workDir)) {
            $workDirPos = strpos($fileKey, $workDir);
            if ($workDirPos !== false) {
                return substr($fileKey, $workDirPos + strlen($workDir));
            }
            return $fileKey; // If workDir not found, use original fileKey
        }
        return $fileKey;
    }
}
