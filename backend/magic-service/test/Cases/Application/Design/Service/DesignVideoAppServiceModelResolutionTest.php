<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Design\Service;

use App\Application\Design\Service\DesignVideoAppService;
use App\Application\Design\Support\DesignDraftTaskResolver;
use App\Application\ModelGateway\Mapper\ModelAttributes;
use App\Application\ModelGateway\Mapper\ModelEntry;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Service\DesignGenerationTaskDomainService;
use App\Domain\Design\Service\DesignVideoSubmissionDomainService;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VideoModel;
use DateTime;
use Hyperf\Amqp\Producer;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionMethod;
use ReflectionProperty;

/**
 * @internal
 */
class DesignVideoAppServiceModelResolutionTest extends TestCase
{
    public function testFindModelOrFailUsesExactOrganizationModelId(): void
    {
        $modelGatewayMapper = $this->createMock(ModelGatewayMapper::class);
        $modelEntry = new ModelEntry(
            new ModelAttributes(
                key: $modelId = 'dq8ajgpv5lme_MiniMax-H3',
                name: $modelId,
                label: 'MiniMax H3',
                icon: '',
                tags: [],
                createdAt: new DateTime(),
                owner: 'MagicAI',
                modelVersion: 'MiniMax-H3',
                providerCode: ProviderCode::MiniMax->value,
            ),
            new VideoModel([], 'MiniMax-H3', '1001', ProviderCode::MiniMax),
        );
        $dataIsolation = (new ReflectionClass(DesignDataIsolation::class))->newInstanceWithoutConstructor();
        $organizationProperty = new ReflectionProperty(BaseDataIsolation::class, 'currentOrganizationCode');
        $organizationProperty->setAccessible(true);
        $organizationProperty->setValue($dataIsolation, 'dq8ajgpv5lme');

        $modelGatewayMapper->expects($this->once())
            ->method('getOrganizationVideoModel')
            ->with(
                $this->callback(static fn (DesignDataIsolation $actual): bool => $actual->getCurrentOrganizationCode() === 'dq8ajgpv5lme'),
                $modelId,
            )
            ->willReturn($modelEntry);

        $taskDomainService = (new ReflectionClass(DesignGenerationTaskDomainService::class))->newInstanceWithoutConstructor();
        $submissionDomainService = (new ReflectionClass(DesignVideoSubmissionDomainService::class))->newInstanceWithoutConstructor();
        // 本用例只测 findModelOrFail，样片解析器不参与，按同文件既有写法跳过构造。
        $draftTaskResolver = (new ReflectionClass(DesignDraftTaskResolver::class))->newInstanceWithoutConstructor();

        $service = new DesignVideoAppService(
            $this->createMock(TaskFileDomainService::class),
            $modelGatewayMapper,
            $taskDomainService,
            $submissionDomainService,
            $draftTaskResolver,
            $this->createMock(Producer::class),
        );

        $method = new ReflectionMethod(DesignVideoAppService::class, 'findModelOrFail');
        $method->setAccessible(true);

        $this->assertSame($modelEntry, $method->invoke($service, $dataIsolation, $modelId));
    }
}
