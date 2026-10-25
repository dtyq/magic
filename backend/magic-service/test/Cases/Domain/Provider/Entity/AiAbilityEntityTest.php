<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Provider\Entity;

use App\Domain\Provider\Entity\AiAbilityEntity;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
final class AiAbilityEntityTest extends TestCase
{
    public function testNewWebSearchApiKeyReplacesStoredKey(): void
    {
        $entity = $this->createWebSearchAbility('stored-key');

        $config = $entity->mergeConfig([
            'providers' => [
                [
                    'provider' => 'deepseek',
                    'enable' => true,
                    'api_key' => 'updated-key',
                    'request_url' => 'https://api.deepseek.com/v1/tools/search',
                ],
            ],
        ]);

        self::assertSame('updated-key', $config['providers'][0]['api_key']);
    }

    public function testMaskedWebSearchApiKeyPreservesStoredKey(): void
    {
        $entity = $this->createWebSearchAbility('sk-existing-api-key');

        $config = $entity->mergeConfig([
            'providers' => [
                [
                    'provider' => 'deepseek',
                    'enable' => true,
                    'api_key' => 'sk-e********-key',
                    'request_url' => 'https://api.deepseek.com/v1/tools/search',
                ],
            ],
        ]);

        self::assertSame('sk-existing-api-key', $config['providers'][0]['api_key']);
    }

    private function createWebSearchAbility(string $apiKey): AiAbilityEntity
    {
        $entity = new AiAbilityEntity();
        $entity->setCode(AiAbilityCode::WebSearch);
        $entity->setConfig([
            'providers' => [
                [
                    'provider' => 'deepseek',
                    'enable' => true,
                    'api_key' => $apiKey,
                    'request_url' => 'https://api.deepseek.com/v1/tools/search',
                ],
            ],
        ]);

        return $entity;
    }
}
