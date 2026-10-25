<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Task\Service;

use App\Application\SuperMagic\Agent\Service\SuperMagicAgentAccessAppService;
use App\Application\SuperMagic\File\Service\FileReferenceAppService;
use App\Application\SuperMagic\File\Service\TaskFileAuthorizationService;
use App\Application\SuperMagic\Message\Assembler\UserMessageDTOAssembler;
use App\Application\SuperMagic\Task\Event\Publish\TaskInitializationPublisher;
use App\Application\SuperMagic\Task\Service\TopicTaskAppService;
use App\Application\SuperMagic\Topic\Service\TopicAgentConfigResolver;
use App\Domain\Chat\DTO\Message\ChatMessage\RichTextMessage;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Common\Entity\ValueObject\SuperMagicExecutionSource;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Message\Entity\MessageQueueEntity;
use App\Domain\SuperMagic\Message\Entity\ValueObject\MessageQueueWriteResult;
use App\Domain\SuperMagic\Message\Service\MessageQueueDomainService;
use App\Domain\SuperMagic\Task\Entity\TaskEntity;
use App\Domain\SuperMagic\Task\Entity\ValueObject\TaskStatus;
use App\Domain\SuperMagic\Task\Service\TaskDomainService;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\SuperMagic\Utils\TiptapBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\SuperMagic\Task\Assembler\OpenTaskMessageAssembler;
use App\Interfaces\SuperMagic\Task\DTO\Request\CreateOpenTaskRequestDTO;
use App\Interfaces\SuperMagic\Task\DTO\Request\CreateTaskRequestDTO;
use Hyperf\Amqp\Producer;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\TranslatorInterface;
use HyperfTest\Cases\Application\SuperMagic\Support\OpenApiUnitTestTrait;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\NullLogger;
use ReflectionClass;
use ReflectionMethod;

/** @internal */
final class TopicTaskHttpMessageTest extends TestCase
{
    use OpenApiUnitTestTrait;

    private OpenTaskMessageAssembler $adapter;

    #[DataProvider('controlMessages')]
    public function testBothHttpEntrancesRejectControlsBeforeTaskOrHiringSideEffects(bool $open, bool $tool): void
    {
        [$service, $topics, $access, $queue] = $this->service();
        $topics->expects($this->never())->method('getTopicById');
        $access->expects($this->never())->method('checkAgentAccess');
        $queue->expects($this->never())->method('createMessage');
        $content = $this->content($tool ? 'normal' : 'interrupt');
        if ($tool) {
            $content['extra']['super_agent']['dynamic_params']['tool_reply'] = ['name' => 'ask_user', 'detail' => ['question_id' => 'call-1', 'answer' => 'yes']];
        }
        $this->expectException(BusinessException::class);
        if ($open) {
            $this->createOpenTask($service, new CreateOpenTaskRequestDTO(['project_id' => '9', 'topic_id' => '2', 'content_type' => 'rich_text', 'rich_content' => $content, 'auto_hire_agent' => true]));
        } else {
            $service->createTask($this->context(), new CreateTaskRequestDTO(['project_id' => '9', 'topic_id' => '2', 'message_type' => 'rich_text', 'message_content' => $content]));
        }
    }

    public static function controlMessages(): array
    {
        return [[true, false], [false, false], [true, true], [false, true]];
    }

    public function testFollowUpRichEnvelopeIsQueuedWithoutFlatteningItsConfiguration(): void
    {
        [$service, $topics, $access, $queue] = $this->service();
        $topics->method('getTopicById')->willReturn($this->topic());
        $access->method('checkAgentAccess')->willReturn([true, '']);
        $queue->expects($this->once())->method('createMessage')->with($this->anything(), 9, 2, $this->callback(static function (array $content): bool {
            return $content['instructs'][0]['value'] === 'follow_up'
                && $content['extra']['super_agent']['model']['model_id'] === 'model'
                && $content['extra']['super_agent']['video_model']['model_id'] === 'video'
                && $content['extra']['super_agent']['dynamic_params']['super_magic_execution_source'] === 'open_api';
        }), $this->anything())->willReturn(new MessageQueueWriteResult((new MessageQueueEntity())->setId(123), true));
        $result = $this->createOpenTask($service, new CreateOpenTaskRequestDTO(['project_id' => '9', 'topic_id' => '2', 'content_type' => 'rich_text', 'rich_content' => $this->content('follow_up')]));
        self::assertSame('123', $result['queue_id']);
    }

    public function testBothDtoCopiesPreserveForceInterruptAndStandardContent(): void
    {
        [$service] = $this->service();
        $dto = new CreateTaskRequestDTO(['project_id' => '9', 'topic_id' => '2', 'message_type' => 'rich_text', 'message_content' => $this->content('normal'), 'force_interrupt' => true]);
        $sourced = (new ReflectionMethod(TopicTaskAppService::class, 'createTaskRequestDTOWithSource'))->invoke($service, $dto, ['channel' => 'webhook']);
        $stamped = (new ReflectionMethod(TopicTaskAppService::class, 'createTaskRequestDTOWithExecutionSource'))->invoke($service, $sourced, SuperMagicExecutionSource::OpenApi);
        self::assertTrue($sourced->isForceInterrupt());
        self::assertTrue($stamped->isForceInterrupt());
        self::assertSame('video', $stamped->getMessageContent()['extra']['super_agent']['video_model']['model_id']);
    }

    public function testInitializationPayloadUsesTheSameParsedMessageAndExistingTask(): void
    {
        [$service, , , , $producer] = $this->service();
        $content = new RichTextMessage($this->content('follow_up'));
        $parsed = UserMessageDTOAssembler::parseMessageContent($content, SuperMagicExecutionSource::OpenApi);
        $producer->expects($this->once())->method('produce')->with($this->callback(static function (TaskInitializationPublisher $publisher): bool {
            $payload = json_decode($publisher->payload(), true);
            return $payload['task_id'] === 100
                && $payload['user_message']['instruction'] === 'follow_up'
                && $payload['user_message']['extra']['video_model']['model_id'] === 'video';
        }))->willReturn(true);
        (new ReflectionMethod(TopicTaskAppService::class, 'deliverMessageToQueue'))->invoke(
            $service,
            DataIsolation::create('caller-org', 'caller'),
            $this->topic(),
            (new TaskEntity())->setId(100),
            $content,
            'rich_text',
            'agent',
            'message',
            null,
            SuperMagicExecutionSource::OpenApi,
            null,
            $parsed,
        );
    }

    private function service(): array
    {
        $service = (new ReflectionClass(TopicTaskAppService::class))->newInstanceWithoutConstructor();
        $topics = $this->createMock(TopicDomainService::class);
        $access = $this->createMock(SuperMagicAgentAccessAppService::class);
        $queue = $this->createMock(MessageQueueDomainService::class);
        $events = $this->createMock(EventDispatcherInterface::class);
        $producer = $this->createMock(Producer::class);
        $tasks = $this->createMock(TaskDomainService::class);
        $tasks->expects($this->never())->method('initTopicTask');
        $files = $this->createMock(TaskFileDomainService::class);
        $references = new FileReferenceAppService($files, $this->createMock(TaskFileRepositoryInterface::class), $this->createMock(TaskFileAuthorizationService::class));
        $this->adapter = new OpenTaskMessageAssembler($references, $files);
        $this->inject($service, TopicTaskAppService::class, [
            'topicDomainService' => $topics, 'superMagicAgentAccessAppService' => $access,
            'messageQueueDomainService' => $queue, 'taskDomainService' => $tasks, 'eventDispatcher' => $events,
            'logger' => new NullLogger(), 'topicAgentConfigResolver' => new TopicAgentConfigResolver(),
            'translator' => ApplicationContext::getContainer()->get(TranslatorInterface::class),
            'producer' => $producer,
        ]);
        return [$service, $topics, $access, $queue, $producer];
    }

    private function createOpenTask(TopicTaskAppService $service, CreateOpenTaskRequestDTO $request): array
    {
        return $service->createTaskFromOpenApi($this->context(), $request, $this->adapter->prepare($this->authorization(), $request));
    }

    private function content(string $instruction): array
    {
        return ['content' => TiptapBuilder::plainTextToJson('hello'), 'instructs' => [['value' => $instruction]], 'extra' => ['super_agent' => ['model' => ['model_id' => 'model'], 'video_model' => ['model_id' => 'video'], 'dynamic_params' => ['message_version' => 'v2', 'super_magic_execution_source' => 'fake']]]];
    }

    private function topic(): TopicEntity
    {
        return (new TopicEntity())->setId(2)->setChatTopicId('22')->setUserId('caller')->setProjectId(9)->setTopicMode('general')->setCurrentTaskStatus(TaskStatus::RUNNING);
    }

    private function context(): RequestContext
    {
        $context = $this->createMock(RequestContext::class);
        $context->method('getUserAuthorization')->willReturn($this->authorization());
        return $context;
    }
}
