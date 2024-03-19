<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Exception;

use RuntimeException;

/**
 * Exception thrown when workspace is not ready within timeout.
 */
class WorkspaceReadyTimeoutException extends RuntimeException
{
}
