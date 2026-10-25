<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\ErrorCode\AgentErrorCode;
use App\ErrorCode\AppMenuErrorCode;
use App\ErrorCode\AsrErrorCode;
use App\ErrorCode\AssetErrorCode;
use App\ErrorCode\AuthenticationErrorCode;
use App\ErrorCode\ChatErrorCode;
use App\ErrorCode\DesignErrorCode;
use App\ErrorCode\EventErrorCode;
use App\ErrorCode\FlowErrorCode;
use App\ErrorCode\GenericErrorCode;
use App\ErrorCode\HttpErrorCode;
use App\ErrorCode\ImageGenerateErrorCode;
use App\ErrorCode\LongTermMemoryErrorCode;
use App\ErrorCode\MagicAccountErrorCode;
use App\ErrorCode\MagicApiErrorCode;
use App\ErrorCode\MagicBaseErrorCode;
use App\ErrorCode\MagicFSErrorCode;
use App\ErrorCode\MCPErrorCode;
use App\ErrorCode\ModeErrorCode;
use App\ErrorCode\PermissionErrorCode;
use App\ErrorCode\ServiceProviderErrorCode;
use App\ErrorCode\ShareErrorCode;
use App\ErrorCode\SkillErrorCode;
use App\ErrorCode\SlidesTemplateErrorCode;
use App\ErrorCode\SuperAgentErrorCode;
use App\ErrorCode\SuperMagicErrorCode;
use App\ErrorCode\TokenErrorCode;
use App\ErrorCode\UserErrorCode;
use App\ErrorCode\UserTaskErrorCode;
use App\ErrorCode\VideoGenerateErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;

return [
    'exception_class' => BusinessException::class,
    'error_code_mapper' => [
        HttpErrorCode::class => [100, 600],
        UserErrorCode::class => [2150, 2999],
        ChatErrorCode::class => [3000, 3999],
        MagicApiErrorCode::class => [4000, 4100],
        MagicAccountErrorCode::class => [4100, 4300],
        GenericErrorCode::class => [5000, 9000],
        EventErrorCode::class => [6000, 6999],
        TokenErrorCode::class => [9000, 10000],
        FlowErrorCode::class => [31000, 31999],
        AgentErrorCode::class => [32000, 32999],
        AssetErrorCode::class => [48000, 48099],
        AuthenticationErrorCode::class => [33000, 33999],
        ModeErrorCode::class => [34000, 34999],
        PermissionErrorCode::class => [42000, 42999],
        ImageGenerateErrorCode::class => [44000, 44999],
        VideoGenerateErrorCode::class => [50000, 50099],
        AsrErrorCode::class => [43000, 43999],
        UserTaskErrorCode::class => [8000, 8999],
        ServiceProviderErrorCode::class => [44000, 44999],
        LongTermMemoryErrorCode::class => [45000, 45999],
        AppMenuErrorCode::class => [46000, 46999],
        MagicBaseErrorCode::class => [48000, 49999],
        SlidesTemplateErrorCode::class => [47000, 47999],
        MCPErrorCode::class => [51500, 51599],
        SuperAgentErrorCode::class => [51000, 51299],
        MagicFSErrorCode::class => [51300, 51399],
        ShareErrorCode::class => [51300, 51400],
        SkillErrorCode::class => [51239, 51338],
        SuperMagicErrorCode::class => [60000, 60999],
        DesignErrorCode::class => [14000, 14999],
    ],
];
