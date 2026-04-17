<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Design\Tool\VideoGeneration;

use App\Application\Design\Tool\VideoGeneration\DesignGeneratedVideoFileNameTool;
use App\Application\ModelGateway\MicroAgent\MicroAgent;
use App\Application\ModelGateway\MicroAgent\MicroAgentFactory;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Odin\Api\Response\ChatCompletionChoice;
use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use RuntimeException;

/**
 * @internal
 */
class DesignGeneratedVideoFileNameToolTest extends TestCase
{
    public function testResolveBaseNameWithoutExtensionUsesAgentResult(): void
    {
        $agent = $this->createMock(MicroAgent::class);
        $agent->method('isEnabled')->willReturn(true);
        $agent->method('easyCall')->willReturn($this->createChatCompletionResponse('第二集吃饭'));

        $factory = $this->createMock(MicroAgentFactory::class);
        $factory->expects($this->once())
            ->method('getAgent')
            ->with('VideoFileNameGenerator', $this->stringContains('VideoFileNameGenerator.agent.yaml'))
            ->willReturn($agent);

        $tool = $this->createTool($factory);

        $result = $tool->resolveBaseNameWithoutExtension(
            $this->createDesignDataIsolation(),
            $this->createEntity('大家在吃饭'),
            '大家在吃饭',
        );

        $this->assertMatchesRegularExpression('/^第二集吃饭_\d{14}$/', $result);
    }

    public function testResolveBaseNameWithoutExtensionReturnsEmptyWhenAgentFails(): void
    {
        $agent = $this->createMock(MicroAgent::class);
        $agent->method('isEnabled')->willReturn(true);
        $agent->method('easyCall')->willThrowException(new RuntimeException('agent failed'));

        $factory = $this->createMock(MicroAgentFactory::class);
        $factory->method('getAgent')->willReturn($agent);

        $tool = $this->createTool($factory);

        $result = $tool->resolveBaseNameWithoutExtension(
            $this->createDesignDataIsolation(),
            $this->createEntity('大家在吃饭'),
            '大家在吃饭',
        );

        $this->assertSame('', $result);
    }

    private function createLoggerFactory(): LoggerFactory
    {
        $logger = $this->createMock(LoggerInterface::class);
        $factory = $this->createMock(LoggerFactory::class);
        $factory->method('get')->willReturn($logger);

        return $factory;
    }

    private function createTool(MicroAgentFactory $factory): DesignGeneratedVideoFileNameTool
    {
        $mockIsolation = $this->createMock(ModelGatewayDataIsolation::class);

        return new class($factory, $this->createLoggerFactory(), $mockIsolation) extends DesignGeneratedVideoFileNameTool {
            public function __construct(
                MicroAgentFactory $microAgentFactory,
                LoggerFactory $loggerFactory,
                private readonly ModelGatewayDataIsolation $mockIsolation,
            ) {
                parent::__construct($microAgentFactory, $loggerFactory);
            }

            protected function createModelGatewayDataIsolation(DesignDataIsolation $dataIsolation): ModelGatewayDataIsolation
            {
                return $this->mockIsolation;
            }
        };
    }

    private function createDesignDataIsolation(): DesignDataIsolation
    {
        $dataIsolation = $this->createMock(DesignDataIsolation::class);
        $dataIsolation->method('getCurrentOrganizationCode')->willReturn('org');
        $dataIsolation->method('getCurrentUserId')->willReturn('user-1');

        return $dataIsolation;
    }

    private function createEntity(string $prompt): DesignGenerationTaskEntity
    {
        $entity = new DesignGenerationTaskEntity();
        $entity->setGenerationId('video-1');
        $entity->setPrompt($prompt);

        return $entity;
    }

    private function createChatCompletionResponse(string $content): ChatCompletionResponse
    {
        $response = $this->createMock(ChatCompletionResponse::class);
        $response->method('getFirstChoice')
            ->willReturn(ChatCompletionChoice::fromArray([
                'index' => 0,
                'message' => [
                    'role' => 'assistant',
                    'content' => $content,
                ],
                'finish_reason' => 'stop',
            ]));

        return $response;
    }
}
