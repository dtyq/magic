<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Chat\Service;

use App\Domain\Chat\Service\MagicConversationDomainService;
use PDOException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use RuntimeException;
use Throwable;

/** @internal */
final class ConversationIdentityRetryTest extends TestCase
{
    #[DataProvider('failures')]
    public function testOnlyRecognizedIdentityConflictsAreRetryable(Throwable $exception, bool $expected): void
    {
        $reflection = new ReflectionClass(MagicConversationDomainService::class);
        $service = $reflection->newInstanceWithoutConstructor();
        self::assertSame($expected, $reflection->getMethod('isRetryableIdentityConflict')->invoke($service, $exception));
    }

    public static function failures(): array
    {
        $error = static function (int $number, string $message): PDOException {
            $exception = new PDOException($message);
            $exception->errorInfo = ['23000', $number, $message];
            return $exception;
        };
        return [
            [$error(1062, "Duplicate entry 'x' for key 'unq_user_conversation'"), true],
            [$error(1062, "Duplicate entry 'x' for key 'magic_chat_conversations.unq_user_conversation'"), true],
            [$error(1213, 'Deadlock found when trying to get lock'), true],
            [$error(1062, "Duplicate entry 'x' for key 'PRIMARY'"), false],
            [$error(1062, "Duplicate entry 'unq_user_conversation' for key 'different'"), false],
            [$error(1062, "Duplicate entry 'x' for key 'unq_user_conversation_suffix'"), false],
            [$error(1205, 'Lock wait timeout exceeded'), false],
            [$error(2006, 'MySQL server has gone away'), false],
            [new RuntimeException('Deadlock found when trying to get lock'), false],
        ];
    }
}
