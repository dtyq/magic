<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Application\ModelGateway\Component\Points\PointComponentInterface;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ImageGenerate\Contract\WatermarkConfigInterface;
use App\Domain\ModelGateway\Service\AccessTokenDomainService;
use App\Domain\ModelGateway\Service\ApplicationDomainService;
use App\Domain\ModelGateway\Service\ModelConfigDomainService;
use App\Domain\ModelGateway\Service\MsgLogDomainService;
use App\Domain\ModelGateway\Service\OrganizationConfigDomainService;
use App\Domain\ModelGateway\Service\UserConfigDomainService;
use App\Domain\Provider\Service\AdminProviderDomainService;
use App\Domain\Provider\Service\ModelFilter\PackageFilterInterface;
use App\Infrastructure\ImageGenerate\ImageWatermarkProcessor;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

abstract class AbstractLLMAppService extends AbstractKernelAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        protected readonly ApplicationDomainService $applicationDomainService,
        protected readonly ModelConfigDomainService $modelConfigDomainService,
        protected readonly AccessTokenDomainService $accessTokenDomainService,
        protected readonly OrganizationConfigDomainService $organizationConfigDomainService,
        protected readonly UserConfigDomainService $userConfigDomainService,
        protected readonly MsgLogDomainService $msgLogDomainService,
        protected readonly MagicUserDomainService $magicUserDomainService,
        protected LoggerFactory $loggerFactory,
        protected AdminProviderDomainService $serviceProviderDomainService,
        protected ModelGatewayMapper $modelGatewayMapper,
        protected FileDomainService $fileDomainService,
        protected WatermarkConfigInterface $watermarkConfig,
        protected ImageWatermarkProcessor $imageWatermarkProcessor,
        protected PointComponentInterface $pointComponent,
        protected PackageFilterInterface $packageFilter,
    ) {
        $this->logger = $this->loggerFactory->get(static::class);
    }

    /**
     * @return array<string,MagicUserEntity>
     */
    public function getUsers(string $organizationCode, array $userIds): array
    {
        return $this->magicUserDomainService->getByUserIds(
            ContactDataIsolation::simpleMake($organizationCode),
            $userIds
        );
    }
}
