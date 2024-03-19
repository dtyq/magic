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

    #[ErrorMessage(message: 'super_magic.agent.builtin_not_allowed')]
    case BuiltinAgentNotAllowed = 60007;

    #[ErrorMessage(message: 'super_magic.agent.store_agent_cannot_publish')]
    case StoreAgentCannotPublish = 60008;

    #[ErrorMessage(message: 'super_magic.agent.can_only_review_pending_version')]
    case CanOnlyReviewPendingVersion = 60009;

    #[ErrorMessage(message: 'super_magic.agent.agent_not_found')]
    case AgentNotFound = 60010;

    #[ErrorMessage(message: 'super_magic.agent.agent_version_not_found')]
    case AgentVersionNotFound = 60011;
}
