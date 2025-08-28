<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

enum SuperMagicErrorCode: int
{
    #[ErrorMessage(message: 'super_magic.validate_failed')]
    case ValidateFailed = 60001;

    #[ErrorMessage(message: 'super_magic.not_found')]
    case NotFound = 60002;

    #[ErrorMessage(message: 'super_magic.save_failed')]
    case SaveFailed = 60003;

    #[ErrorMessage(message: 'super_magic.delete_failed')]
    case DeleteFailed = 60004;

    #[ErrorMessage(message: 'super_magic.operation_failed')]
    case OperationFailed = 60005;

    #[ErrorMessage(message: 'super_magic.agent.limit_exceeded')]
    case AgentLimitExceeded = 60006;
}
