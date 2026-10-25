<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Contact;

use App\Application\Chat\Service\MagicDepartmentAppService;
use App\Application\Chat\Service\MagicUserContactAppService;
use App\Domain\Contact\DTO\DepartmentQueryDTO;
use App\Domain\Contact\DTO\UserQueryDTO;
use App\Domain\Contact\Entity\MagicDepartmentEntity;
use App\Domain\Contact\Entity\ValueObject\UserQueryType;
use App\ErrorCode\ChatErrorCode;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Chat\DTO\UserDepartmentDetailDTO;
use App\Interfaces\Contact\Facade\Open\MagicContactSandboxApi;
use Hyperf\Context\ApplicationContext;
use Hyperf\Context\Context;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\HttpServer\Contract\RequestInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;

/** @internal */
class MagicContactSandboxApiTest extends TestCase
{
    private static bool $minimalContextSet = false;

    protected function tearDown(): void
    {
        Context::set('magic-user-authorization', null);
        parent::tearDown();
    }

    public function testSearchUsersUsesCurrentIdentityAndReturnsOnlyAllowedFields(): void
    {
        $authorization = $this->authorization();
        RequestCoContext::setUserAuthorization($authorization);
        $request = $this->request(['query' => ' Alice ', 'page_token' => '20', 'organization_code' => 'other-org']);
        $users = $this->createMock(MagicUserContactAppService::class);
        $users->expects(self::once())->method('searchDepartmentUser')->with(
            self::callback(static fn (UserQueryDTO $query): bool => $query->getQuery() === 'Alice'
                && $query->getPageToken() === '20'
                && $query->getPageSize() === 20
                && $query->getQueryType() === UserQueryType::UserAndDepartmentFullPath
                && $query->isFilterAgent()),
            $authorization
        )->willReturn([
            'items' => [
                new UserDepartmentDetailDTO([
                    'user_id' => 'u1', 'organization_code' => 'org-1', 'nickname' => 'Alice', 'real_name' => 'Alice A',
                    'job_title' => 'Engineer', 'phone' => '12345678901',
                    'full_path_nodes' => ['d1' => [
                        ['department_id' => '-1', 'department_name' => 'Organization', 'parent_department_id' => '-1', 'path' => '-1'],
                        ['department_id' => 'd1', 'department_name' => 'Engineering', 'parent_department_id' => '-1', 'path' => '-1/d1'],
                    ]],
                ]),
                new UserDepartmentDetailDTO(['user_id' => 'u2', 'organization_code' => 'other-org', 'nickname' => 'Other', 'real_name' => 'Other B']),
            ],
            'has_more' => true,
            'page_token' => '40',
        ]);

        $departments = $this->createMock(MagicDepartmentAppService::class);
        $departments->expects(self::once())->method('getDepartmentByIds')->with(
            self::callback(static fn (DepartmentQueryDTO $query): bool => $query->getDepartmentIds() === ['-1', 'd1']),
            $authorization
        )->willReturn([
            $this->department('-1', '-1', 'Organization', '-1', 0),
            $this->department('d1', '-1', 'Engineering', '-1/d1', 1),
        ]);
        $api = new MagicContactSandboxApi($request, $users, $departments);
        self::assertSame([
            'items' => [[
                'user_id' => 'u1', 'nickname' => 'Alice', 'real_name' => 'Alice A', 'job_title' => 'Engineer',
                'departments' => [['department_id' => 'd1', 'name' => 'Engineering', 'path_names' => ['Organization', 'Engineering']]],
            ]],
            'has_more' => true,
            'page_token' => '40',
        ], $api->searchUsers());
    }

    public function testSearchDepartmentsUsesCurrentIdentityAndMarksBoundedCoverage(): void
    {
        $authorization = $this->authorization();
        RequestCoContext::setUserAuthorization($authorization);
        $request = $this->request(['query' => ' Sales ', 'organization_code' => 'other-org']);
        $departments = $this->createMock(MagicDepartmentAppService::class);
        $departments->expects(self::once())->method('searchDepartment')->with(
            self::callback(static fn (DepartmentQueryDTO $query): bool => $query->getQuery() === 'Sales'),
            $authorization
        )->willReturn([
            'items' => [
                $this->department('d1', '-1', 'Sales', '-1/d1', 1),
                $this->department('d2', '-1', 'Other', '-1/d2', 1, 'other-org'),
            ],
        ]);
        $departments->expects(self::once())->method('getDepartmentByIds')->with(
            self::callback(static fn (DepartmentQueryDTO $query): bool => $query->getDepartmentIds() === ['-1', 'd1']),
            $authorization
        )->willReturn([
            $this->department('-1', '-1', 'Organization', '-1', 0),
            $this->department('d1', '-1', 'Sales', '-1/d1', 1),
        ]);

        $api = new MagicContactSandboxApi($request, $this->createMock(MagicUserContactAppService::class), $departments);
        self::assertSame([
            'items' => [['department_id' => 'd1', 'name' => 'Sales', 'parent_department_id' => '-1', 'path_names' => ['Organization', 'Sales']]],
            'coverage' => 'bounded',
        ], $api->searchDepartments());
    }

    public function testSearchDepartmentsDoesNotExposeChildOfHiddenDepartment(): void
    {
        $authorization = $this->authorization();
        RequestCoContext::setUserAuthorization($authorization);
        $departments = $this->createMock(MagicDepartmentAppService::class);
        $departments->method('searchDepartment')->willReturn([
            'items' => [$this->department('child', 'hidden', 'Child', '-1/hidden/child', 2)],
        ]);
        // getDepartmentByIds removes the hidden ancestor under the existing contact visibility rule.
        $departments->method('getDepartmentByIds')->willReturn([
            $this->department('-1', '-1', 'Organization', '-1', 0),
            $this->department('child', 'hidden', 'Child', '-1/hidden/child', 2),
        ]);

        $api = new MagicContactSandboxApi($this->request(['query' => 'Child']), $this->createMock(MagicUserContactAppService::class), $departments);
        self::assertSame(['items' => [], 'coverage' => 'bounded'], $api->searchDepartments());
    }

    public function testSearchUsersOmitsHiddenDepartmentAndItsJobTitle(): void
    {
        $authorization = $this->authorization();
        RequestCoContext::setUserAuthorization($authorization);
        $users = $this->createMock(MagicUserContactAppService::class);
        $users->method('searchDepartmentUser')->willReturn([
            'items' => [new UserDepartmentDetailDTO([
                'user_id' => 'u1', 'organization_code' => 'org-1', 'nickname' => 'Alice', 'real_name' => 'Alice A',
                'job_title' => 'Private role',
                'full_path_nodes' => ['child' => [
                    ['department_id' => '-1', 'department_name' => 'Organization', 'parent_department_id' => '-1', 'path' => '-1'],
                    ['department_id' => 'hidden', 'department_name' => 'Hidden', 'parent_department_id' => '-1', 'path' => '-1/hidden'],
                    ['department_id' => 'child', 'department_name' => 'Child', 'parent_department_id' => 'hidden', 'path' => '-1/hidden/child'],
                ], 'd2' => [
                    ['department_id' => '-1', 'department_name' => 'Organization', 'parent_department_id' => '-1', 'path' => '-1'],
                    ['department_id' => 'd2', 'department_name' => 'Public', 'parent_department_id' => '-1', 'path' => '-1/d2'],
                ]],
            ])],
        ]);
        $departments = $this->createMock(MagicDepartmentAppService::class);
        $departments->method('getDepartmentByIds')->willReturn([
            $this->department('-1', '-1', 'Organization', '-1', 0),
            $this->department('child', 'hidden', 'Child', '-1/hidden/child', 2),
            $this->department('d2', '-1', 'Public', '-1/d2', 1),
        ]);

        $api = new MagicContactSandboxApi($this->request(['query' => 'Alice']), $users, $departments);
        self::assertSame([
            'items' => [[
                'user_id' => 'u1', 'nickname' => 'Alice', 'real_name' => 'Alice A', 'job_title' => '',
                'departments' => [['department_id' => 'd2', 'name' => 'Public', 'path_names' => ['Organization', 'Public']]],
            ]],
            'has_more' => false,
            'page_token' => '',
        ], $api->searchUsers());
    }

    public function testSearchRejectsMissingUserAuthorization(): void
    {
        $this->setMinimalExceptionContext();
        Context::set('magic-user-authorization', null);
        $users = $this->createMock(MagicUserContactAppService::class);
        $users->expects(self::never())->method('searchDepartmentUser');
        $api = new MagicContactSandboxApi($this->request(['query' => 'Alice']), $users, $this->createMock(MagicDepartmentAppService::class));

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(PermissionErrorCode::AccessDenied->value);
        $api->searchUsers();
    }

    public function testSearchRejectsEmptyQueryBeforeCallingService(): void
    {
        $this->setMinimalExceptionContext();
        RequestCoContext::setUserAuthorization($this->authorization());
        $users = $this->createMock(MagicUserContactAppService::class);
        $users->expects(self::never())->method('searchDepartmentUser');
        $api = new MagicContactSandboxApi($this->request(['query' => '  ']), $users, $this->createMock(MagicDepartmentAppService::class));

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(ChatErrorCode::INPUT_PARAM_ERROR->value);
        $api->searchUsers();
    }

    public function testSearchRejectsInvalidPageTokenBeforeCallingService(): void
    {
        $this->setMinimalExceptionContext();
        RequestCoContext::setUserAuthorization($this->authorization());
        $users = $this->createMock(MagicUserContactAppService::class);
        $users->expects(self::never())->method('searchDepartmentUser');
        $api = new MagicContactSandboxApi($this->request(['query' => 'Alice', 'page_token' => '-1']), $users, $this->createMock(MagicDepartmentAppService::class));

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(ChatErrorCode::INPUT_PARAM_ERROR->value);
        $api->searchUsers();
    }

    private function authorization(): MagicUserAuthorization
    {
        $authorization = new MagicUserAuthorization();
        $authorization->setId('caller');
        $authorization->setOrganizationCode('org-1');
        $authorization->setStatus('1');
        return $authorization;
    }

    private function department(string $id, string $parentId, string $name, string $path, int $level, string $organizationCode = 'org-1'): MagicDepartmentEntity
    {
        return new MagicDepartmentEntity([
            'department_id' => $id,
            'parent_department_id' => $parentId,
            'name' => $name,
            'path' => $path,
            'level' => $level,
            'organization_code' => $organizationCode,
        ]);
    }

    private function request(array $input): RequestInterface
    {
        $request = $this->createMock(RequestInterface::class);
        $request->method('input')->willReturnCallback(static fn (string $key, mixed $default = null): mixed => $input[$key] ?? $default);
        return $request;
    }

    private function setMinimalExceptionContext(): void
    {
        if (ApplicationContext::hasContainer() && ! self::$minimalContextSet) {
            return;
        }

        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->with('error_message')->willReturn([
            'exception_class' => BusinessException::class,
            'error_code_mapper' => [
                ChatErrorCode::class => [3000, 3999],
                PermissionErrorCode::class => [42000, 42999],
            ],
        ]);
        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')->willReturnCallback(static fn (string $key): string => $key);
        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->willReturnCallback(static fn (string $id): mixed => match ($id) {
            ConfigInterface::class => $config,
            TranslatorInterface::class => $translator,
            default => null,
        });
        ApplicationContext::setContainer($container);
        self::$minimalContextSet = true;
    }
}
