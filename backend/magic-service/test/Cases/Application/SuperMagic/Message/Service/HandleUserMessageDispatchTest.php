<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Message\Service;

use App\Application\SuperMagic\Message\DTO\UserMessageDTO;
use App\Application\SuperMagic\Message\Service\HandleUserMessageAppService;
use App\Application\SuperMagic\Task\DTO\InterruptClientNotification;
use App\Domain\Chat\DTO\Message\ChatMessage\UserToolCallMessage;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Message\Entity\ValueObject\ChatInstruction;
use App\Infrastructure\Core\Exception\BusinessException;
use HyperfTest\Cases\Application\SuperMagic\Support\OpenApiUnitTestTrait;
use PHPUnit\Framework\TestCase;
use RuntimeException;

/** @internal */
final class HandleUserMessageDispatchTest extends TestCase
{
    use OpenApiUnitTestTrait;

    public function testHttpTaskIdAndNormalMessageReachChatExactlyOnce(): void
    {
        $service = $this->service();
        $isolation = DataIsolation::create('org', 'user');
        $message = $this->message(ChatInstruction::FollowUp);
        $service->expects($this->once())->method('handleChatMessage')->with($isolation, $message, 100);
        $service->expects($this->never())->method('handleInternalMessage');
        $service->expects($this->never())->method('handleUserToolCallMessage');
        self::assertNull($service->handleMessage($isolation, $message, existingTaskId: 100));
    }

    public function testInterruptNotificationIsReturnedToTransport(): void
    {
        $service = $this->service();
        $notification = new InterruptClientNotification(9, '10', 'stop');
        $service->expects($this->once())->method('handleInternalMessage')->willReturn($notification);
        $service->expects($this->never())->method('handleChatMessage');
        $service->expects($this->never())->method('handleUserToolCallMessage');
        self::assertSame($notification, $service->handleMessage(DataIsolation::create('org', 'user'), $this->message(ChatInstruction::Interrupted)));
    }

    public function testNativeToolReplyWinsOverInterrupt(): void
    {
        $service = $this->service();
        $tool = (new UserToolCallMessage())->setName('ask_user')->setToolCallId('call-1');
        $service->expects($this->once())->method('handleUserToolCallMessage')->with($this->anything(), $this->anything(), $tool);
        $service->expects($this->never())->method('handleInternalMessage');
        $service->expects($this->never())->method('handleChatMessage');
        $service->handleMessage(DataIsolation::create('org', 'user'), $this->message(ChatInstruction::Interrupted), $tool);
    }

    public function testLegacyToolReplyIsResolvedByTheSameDispatcher(): void
    {
        $service = $this->service();
        $message = $this->message(ChatInstruction::Normal);
        $message->setDynamicParams(['tool_reply' => ['name' => 'ask_user', 'detail' => ['question_id' => 'call-old', 'answer' => 'yes']]]);
        $service->expects($this->once())->method('handleUserToolCallMessage')->with($this->anything(), $message, $this->callback(static fn (UserToolCallMessage $reply): bool => $reply->getToolCallId() === 'call-old' && $reply->getDetail() === ['answer' => 'yes']));
        $service->expects($this->never())->method('handleChatMessage');
        $service->handleMessage(DataIsolation::create('org', 'user'), $message);
    }

    public function testConsumerCannotDispatchControlMessagesAndErrorsAreNotSwallowed(): void
    {
        $service = $this->service();
        $service->expects($this->never())->method('handleInternalMessage');
        $service->expects($this->never())->method('handleChatMessage');
        $this->expectException(BusinessException::class);
        $service->handleMessage(DataIsolation::create('org', 'user'), $this->message(ChatInstruction::Interrupted), existingTaskId: 100);
    }

    public function testCoreFailurePropagatesToTheTransport(): void
    {
        $service = $this->service();
        $cause = new RuntimeException('Sandbox unavailable');
        $service->method('handleChatMessage')->willThrowException($cause);
        $this->expectExceptionObject($cause);
        $service->handleMessage(DataIsolation::create('org', 'user'), $this->message(ChatInstruction::Normal));
    }

    private function service(): HandleUserMessageAppService
    {
        return $this->getMockBuilder(HandleUserMessageAppService::class)->disableOriginalConstructor()->onlyMethods(['handleChatMessage', 'handleInternalMessage', 'handleUserToolCallMessage'])->getMock();
    }

    private function message(ChatInstruction $instruction): UserMessageDTO
    {
        return new UserMessageDTO('agent', 'conversation', '9', 9, 'hello', instruction: $instruction);
    }
}
