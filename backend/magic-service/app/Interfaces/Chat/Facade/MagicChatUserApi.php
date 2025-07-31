<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\Facade;

use App\Application\Chat\Service\MagicUserContactAppService;
use App\Domain\Contact\DTO\FriendQueryDTO;
use App\Domain\Contact\DTO\UserUpdateDTO;
use App\Domain\Contact\Entity\ValueObject\AddFriendType;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\Interfaces\Chat\Assembler\PageListAssembler;
use App\Interfaces\Chat\Assembler\UserAssembler;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;
use JetBrains\PhpStorm\ArrayShape;
use Throwable;

#[ApiResponse('low_code')]
class MagicChatUserApi extends AbstractApi
{
    public function __construct(
        private readonly MagicUserContactAppService $userAppService,
    ) {
    }

    /**
     * @throws Throwable
     */
    public function addFriend(string $friendId): array
    {
        $authorization = $this->getAuthorization();
        $addResult = $this->userAppService->addFriend($authorization, $friendId, AddFriendType::APPLY);
        return ['success' => $addResult];
    }

    /**
     * @deprecated
     */
    public function aiRegister(): array
    {
        return [];
    }

    public function searchFriend(RequestInterface $request): array
    {
        $this->getAuthorization();
        $keyword = (string) $request->input('keyword', '');
        return $this->userAppService->searchFriend($keyword);
    }

    /**
     * 返回 ai 的头像昵称等信息.
     * @throws Throwable
     */
    #[ArrayShape([
        'organization_code' => 'string',
        'user_id' => 'string',
        'description' => 'string',
        'like_num' => 'int',
        'label' => 'string',
        'status' => 'int',
        'nickname' => 'string',
        'avatar_url' => 'string',
        'extra' => 'string',
        'created_at' => 'string',
        'updated_at' => 'string',
        'deleted_at' => 'null',
        'user_type' => 'int',
    ])]
    public function queries(RequestInterface $request): array
    {
        $ids = (array) $request->input('ids', '');
        $authorization = $this->getAuthorization();
        $userInfos = $this->userAppService->getUserWithoutDepartmentInfoByIds($ids, $authorization);
        return UserAssembler::getUserInfos($userInfos);
    }

    public function getUserFriendList(RequestInterface $request): array
    {
        $authorization = $this->getAuthorization();
        $pageToken = (string) $request->query('page_token', '');
        // 0:ai 1:人类 2: ai和人类
        $friendType = (int) $request->query('friend_type', '');
        // 将 flow_codes 当做 数据表中的 ai_code 处理了
        $aiCodes = (array) $request->input('flow_codes', []);
        $friendQueryDTO = new FriendQueryDTO();
        $friendType = UserType::from($friendType);
        $friendQueryDTO->setFriendType($friendType);
        $friendQueryDTO->setPageToken($pageToken);
        $friendQueryDTO->setAiCodes($aiCodes);
        $friends = $this->userAppService->getUserFriendList($friendQueryDTO, $authorization);
        return PageListAssembler::pageByMysql($friends);
    }

    /**
     * Get user details for all organizations under the current account.
     *
     * @throws Throwable
     */
    public function getAccountUsersDetail(RequestInterface $request): array
    {
        // Prioritize getting authorization from header, complying with RESTful standards
        $authorization = (string) $request->header('authorization', '');

        // If not in header, try to get from query parameters (for compatibility)
        if (empty($authorization)) {
            $authorization = (string) $request->query('authorization', '');
        }

        if (empty($authorization)) {
            return [
                'items' => [],
                'has_more' => false,
                'page_token' => '',
                'error' => 'Authorization token cannot be empty',
            ];
        }

        // Get optional organization code from header
        $organizationCode = (string) $request->header('organization-code', '');

        // Pass null if organization code is empty
        $organizationCode = empty($organizationCode) ? null : $organizationCode;
        return $this->userAppService->getUsersDetailByAccountAuthorization($authorization, $organizationCode);
    }

    /*
     * 是否允许更新用户信息.
     */
    public function getUserUpdatePermission(): array
    {
        $authorization = $this->getAuthorization();
        return $this->userAppService->getUserUpdatePermission($authorization);
    }

    /**
     * 更新用户信息
     * 支持更新字段：
     * 1. avatar_url: 头像
     * 2. nickname:   昵称.
     */
    public function updateUserInfo(RequestInterface $request): array
    {
        $authorization = $this->getAuthorization();

        $userUpdateDTO = new UserUpdateDTO();
        $userUpdateDTO->setAvatarUrl($request->input('avatar_url', null));
        $userUpdateDTO->setNickname($request->input('nickname', null));

        $userEntity = $this->userAppService->updateUserInfo($authorization, $userUpdateDTO);
        return $userEntity->toArray();
    }
}
