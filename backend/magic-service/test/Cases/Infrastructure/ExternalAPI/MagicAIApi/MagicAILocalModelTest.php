<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\MagicAIApi;

use App\Application\ModelGateway\Event\Subscribe\OfficialAppTokenCheckSubscriber;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use Hyperf\Odin\Message\UserMessage;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class MagicAILocalModelTest extends TestCase
{
    public function setUp(): void
    {
        parent::setUp();

        // 初始化启动
        make(OfficialAppTokenCheckSubscriber::class)->process(new class {});
    }

    public function testEmbeddings()
    {
        $modelGatewayMapper = di(ModelGatewayMapper::class);
        $model = $modelGatewayMapper->getEmbeddingModelProxy('dmeta-embedding');
        $response = $model->embeddings('hello world', businessParams: [
            'organization_id' => '008',
            'user_id' => '007',
            'business_id' => 'test',
        ]);
        $this->assertIsArray($response->getData()[0]->getEmbedding());
    }

    public function testChat()
    {
        $modelGatewayMapper = di(ModelGatewayMapper::class);
        $model = $modelGatewayMapper->getChatModelProxy('gpt-4o-global');
        $messages = [
            new UserMessage('你好 你是谁'),
        ];
        $response = $model->chat(
            messages: $messages,
            temperature: 0.9,
            maxTokens: 100,
            stop: [],
            tools: [],
            businessParams: [
                'organization_id' => '008',
                'user_id' => '007',
                'business_id' => 'test',
            ]
        );
        $this->assertIsString($response->getFirstChoice()->getMessage()->getContent());
    }
}
