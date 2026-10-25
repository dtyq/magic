<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\Task\Service;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\SuperAgentExtra;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Task\Entity\TaskEntity;
use App\Domain\SuperMagic\Task\Entity\ValueObject\TaskContext;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Task\Service\CrossProjectMentionPathTranslator;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\Request\ChatMessageRequest;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Agent\Response\AgentResponse;
use Hyperf\Config\Config;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\NullLogger;
use ReflectionClass;
use ReflectionProperty;

/**
 * Verify the serialized sandbox request, without starting services or querying a database.
 * @internal
 */
final class AgentDomainServiceWebSearchTest extends TestCase
{
    private ?ContainerInterface $previousContainer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')->with('prompt.disable_web_search_constraint')->willReturn(' (Do not use internet search tools)');
        $services = [ConfigInterface::class => new Config([]), TranslatorInterface::class => $translator];
        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->willReturnCallback(static fn (string $id): mixed => $services[$id]);
        $container->method('has')->willReturnCallback(static fn (string $id): bool => isset($services[$id]));
        ApplicationContext::setContainer($container);
    }

    protected function tearDown(): void
    {
        (new ReflectionProperty(ApplicationContext::class, 'container'))->setValue(null, $this->previousContainer);
        parent::tearDown();
    }

    #[DataProvider('searchSettings')]
    public function testChatExplicitlySendsEffectiveSettingAndPreservesLegacyConstraint(bool $hasExtra, ?bool $setting, bool $expected): void
    {
        $class = new ReflectionClass(AgentDomainService::class);
        $dependencies = [];
        foreach ($class->getConstructor()->getParameters() as $parameter) {
            $dependencies[$parameter->getName()] = $parameter->getName() === 'crossProjectMentionPathTranslator'
                ? new CrossProjectMentionPathTranslator()
                : $this->createMock($parameter->getType()->getName());
        }
        $dependencies['loggerFactory']->method('get')->willReturn(new NullLogger());
        // Both dynamic configuration sources deliberately conflict with the message extra.
        $dependencies['dynamicConfigManager']->method('getByTaskId')->willReturn(['enable_web_search' => ! $expected]);
        $dependencies['userInfoAppService']->method('getUserInfo')->willReturn([]);

        $topic = $this->createMock(TopicEntity::class);
        $topic->method('getId')->willReturn(2);
        $topic->method('getProjectId')->willReturn(1);
        $dependencies['topicRepository']->method('getTopicById')->with(2)->willReturn($topic);
        $project = $this->createMock(ProjectEntity::class);
        $project->method('getId')->willReturn(1);
        $project->method('getWorkspaceId')->willReturn(null);
        $dependencies['projectRepository']->method('findById')->with(1)->willReturn($project);

        $dependencies['agent']->expects($this->once())->method('sendChatMessage')
            ->willReturnCallback(function (DataIsolation $isolation, string $sandboxId, ChatMessageRequest $request) use ($expected): AgentResponse {
                $payload = $request->toArray();
                self::assertSame($expected, $payload['dynamic_config']['enable_web_search']);
                self::assertSame('Analyze workspace files' . ($expected ? '' : ' (Do not use internet search tools)'), $payload['prompt']);
                self::assertSame('sandbox-1', $sandboxId);
                return AgentResponse::fromApiResponse(['code' => 1000, 'message' => 'ok', 'data' => []]);
            });
        $service = $class->newInstanceArgs(array_values($dependencies));
        $isolation = $this->createMock(DataIsolation::class);
        $isolation->method('getCurrentUserId')->willReturn('user-1');
        $isolation->method('getLanguage')->willReturn('en_US');
        $task = TaskEntity::fromArray(['id' => 3, 'project_id' => 1, 'topic_id' => 2, 'prompt' => 'Analyze workspace files', 'mentions' => '[]']);
        $extra = $hasExtra ? new SuperAgentExtra() : null;
        $extra?->setEnableWebSearch($setting);
        $context = new TaskContext(
            task: $task,
            dataIsolation: $isolation,
            chatConversationId: 'conversation-1',
            chatTopicId: 'chat-topic-1',
            agentUserId: 'agent-1',
            sandboxId: 'sandbox-1',
            dynamicConfig: ['enable_web_search' => ! $expected],
            messageId: 'message-1',
            extra: $extra,
        );

        $service->sendChatMessage($isolation, $context);

        self::assertSame('Analyze workspace files', $task->getPrompt());
    }

    public static function searchSettings(): array
    {
        return [
            'disabled' => [true, false, false],
            'enabled' => [true, true, true],
            'unset' => [true, null, true],
            'no extra' => [false, null, true],
        ];
    }
}
