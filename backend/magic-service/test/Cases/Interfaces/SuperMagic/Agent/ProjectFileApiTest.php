<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\SuperMagic\Agent;

use App\Application\SuperMagic\Project\Service\ProjectAppService;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\Facade\Agent\ProjectFileApi;
use App\Interfaces\SuperMagic\File\DTO\Request\GetProjectAttachmentsV2RequestDTO;
use Hyperf\HttpServer\Contract\RequestInterface;
use PHPUnit\Framework\TestCase;
use Throwable;

/**
 * @internal
 */
final class ProjectFileApiTest extends TestCase
{
    public function testUsesAuthenticatedUserPathAndBoundedPagination(): void
    {
        $request = $this->createMock(RequestInterface::class);
        $request->method('all')->willReturn(['page_size' => 50, 'next_parent_ids' => []]);
        $service = $this->createMock(ProjectAppService::class);
        $service->expects(self::once())
            ->method('getProjectAttachmentsV2')
            ->with(
                self::isInstanceOf(RequestContext::class),
                self::callback(static fn (GetProjectAttachmentsV2RequestDTO $dto): bool => $dto->getProjectId() === '123'
                    && $dto->getPageSize() === 50
                    && $dto->getToken() === null
                    && ! $dto->hasScope())
            )
            ->willReturn(['list' => [], 'next_parent_ids' => [], 'has_more' => false]);

        $authorization = $this->createMock(MagicUserAuthorization::class);
        $api = new class($request, $service, $authorization) extends ProjectFileApi {
            public function __construct(
                RequestInterface $request,
                ProjectAppService $service,
                private readonly MagicUserAuthorization $authorization
            ) {
                parent::__construct($request, $service);
            }

            protected function getAuthorization(): MagicUserAuthorization
            {
                return $this->authorization;
            }
        };

        self::assertSame(['list' => [], 'next_parent_ids' => [], 'has_more' => false], $api->index(new RequestContext(), '123'));
    }

    public function testRejectsTokenOverrideBeforeCallingApplicationService(): void
    {
        $request = $this->createMock(RequestInterface::class);
        $request->method('all')->willReturn(['page_size' => 50, 'token' => 'other-user-token']);
        $service = $this->createMock(ProjectAppService::class);
        $service->expects(self::never())->method('getProjectAttachmentsV2');
        $authorization = $this->createMock(MagicUserAuthorization::class);
        $api = new class($request, $service, $authorization) extends ProjectFileApi {
            public function __construct(
                RequestInterface $request,
                ProjectAppService $service,
                private readonly MagicUserAuthorization $authorization
            ) {
                parent::__construct($request, $service);
            }

            protected function getAuthorization(): MagicUserAuthorization
            {
                return $this->authorization;
            }
        };

        $this->expectException(Throwable::class);
        $api->index(new RequestContext(), '123');
    }
}
