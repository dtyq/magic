<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Repository\Persistence;

use App\Application\Chat\Event\Publish\InitDefaultAssistantConversationDispatchPublisher;
use App\Domain\Agent\Event\InitDefaultAssistantConversationEvent;
use App\Domain\Contact\Entity\Item\UserExtra;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\AccountStatus;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Entity\ValueObject\UserIdType;
use App\Domain\Contact\Entity\ValueObject\UserOption;
use App\Domain\Contact\Entity\ValueObject\UserStatus;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\Domain\Contact\Factory\ContactUserFactory;
use App\Domain\Contact\Repository\Facade\MagicUserRepositoryInterface;
use App\Domain\Contact\Repository\Persistence\Model\AccountModel;
use App\Domain\Contact\Repository\Persistence\Model\UserModel;
use App\ErrorCode\ChatErrorCode;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Chat\Assembler\UserAssembler;
use Hyperf\Amqp\Producer;
use Hyperf\Cache\Annotation\Cacheable;
use Hyperf\Cache\Annotation\CacheEvict;
use Hyperf\Codec\Json;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

readonly class MagicUserRepository implements MagicUserRepositoryInterface
{
    private LoggerInterface $logger;

    public function __construct(
        protected UserModel $userModel,
        protected AccountModel $accountModel,
        protected LoggerFactory $loggerFactory,
        protected Producer $producer,
    ) {
        $this->logger = $loggerFactory->get('user');
    }

    // 返回最受欢迎和最新加入的 agent 列表
    public function getSquareAgentList(): array
    {
        // 最受欢迎
        $popular = $this->userModel::query()
            ->where('status', UserStatus::Activated->value)
            ->where('user_type', UserType::Ai->value)
            ->where('like_num', '>', 0)
            ->orderBy('like_num', 'desc')
            ->limit(3);
        $popular = Db::select($popular->toSql(), $popular->getBindings());
        $popularIds = array_column($popular, 'id');
        // 最新
        $latest = $this->userModel::query()
            ->where('status', UserStatus::Activated->value)
            ->where('user_type', UserType::Ai->value)
            ->whereNotIn('id', $popularIds)
            ->orderBy('created_at', 'desc')
            ->limit(3);
        $latest = Db::select($latest->toSql(), $latest->getBindings());
        // todo 统计好友数量
        return [$popular, $latest];
    }

    public function createUser(MagicUserEntity $userDTO): MagicUserEntity
    {
        if ($userDTO->getId() === null) {
            $userDTO->setId(IdGenerator::getSnowId());
        }
        if (empty($userDTO->getMagicId())) {
            ExceptionBuilder::throw(UserErrorCode::ACCOUNT_ERROR);
        }
        $userData = $userDTO->toArray();
        $time = date('Y-m-d H:i:s');
        $userData['created_at'] = $time;
        $userData['updated_at'] = $time;
        $userData['extra'] = $this->getExtraString($userDTO->getExtra());
        $this->userModel::query()->create($userData);
        $userEntity = UserAssembler::getUserEntity($userData);
        $this->publishInitDefaultAssistantConversationEventForMQ($userEntity);
        return $userEntity;
    }

    /**
     * @param MagicUserEntity[] $userDTOs
     * @return MagicUserEntity[]
     */
    public function createUsers(array $userDTOs): array
    {
        $users = [];
        $userEntities = [];
        $time = date('Y-m-d H:i:s');
        foreach ($userDTOs as $userDTO) {
            if ($userDTO->getId() === null) {
                $userDTO->setId(IdGenerator::getSnowId());
            }
            if (empty($userDTO->getMagicId())) {
                ExceptionBuilder::throw(UserErrorCode::ACCOUNT_ERROR);
            }
            $userDTO->setCreatedAt($time);
            $userDTO->setUpdatedAt($time);
            $userDTO->setDeletedAt(null);
            $userData = $userDTO->toArray();
            $userData['extra'] = $this->getExtraString($userDTO->getExtra());
            $users[] = $userData;
            $userEntities[] = $userDTO;
            $this->publishInitDefaultAssistantConversationEventForMQ($userDTO);
        }
        $this->userModel::query()->insert($users);
        return $userEntities;
    }

    public function getUserById(string $id): ?MagicUserEntity
    {
        $user = $this->getUser($id);
        if (empty($user)) {
            return null;
        }
        return UserAssembler::getUserEntity($user);
    }

    public function getUserByMagicId(DataIsolation $dataIsolation, string $id): ?MagicUserEntity
    {
        $user = UserModel::query()
            ->where('magic_id', $id)
            ->where('organization_code', $dataIsolation->getCurrentOrganizationCode());
        $user = Db::select($user->toSql(), $user->getBindings())[0] ?? null;
        return ! empty($user) ? UserAssembler::getUserEntity($user) : null;
    }

    /**
     * @return MagicUserEntity[]
     */
    public function getUserByIdsAndOrganizations(array $ids, array $organizationCodes = [], array $column = ['*']): array
    {
        $query = $this->userModel::query()->select($column)->whereIn('user_id', $ids);
        if (! empty($organizationCodes)) {
            $query->whereIn('organization_code', $organizationCodes);
        }
        $query = $query->where('status', AccountStatus::Normal->value);
        $usersInfo = Db::select($query->toSql(), $query->getBindings());
        $usersInfo = array_values(array_column($usersInfo, null, 'id'));
        return UserAssembler::getUserEntities($usersInfo);
    }

    /**
     * @return array<string, MagicUserEntity>
     */
    public function getUserByPageToken(string $pageToken = '', int $pageSize = 50): array
    {
        $res = $this->userModel::query()
            ->when(! empty($pageToken), function ($query) use ($pageToken) {
                $query->where('id', '<', $pageToken);
            })
            ->forPage(1, $pageSize)
            ->orderBy('id', 'desc')
            ->get();
        $list = [];
        foreach ($res as $model) {
            $entity = ContactUserFactory::createByModel($model);
            $list[$entity->getUserId()] = $entity;
        }
        return $list;
    }

    /**
     * @return array<string, MagicUserEntity>
     */
    public function getByUserIds(string $organizationCode, array $userIds): array
    {
        $query = UserModel::query()->where('organization_code', $organizationCode);
        $query->whereIn('user_id', $userIds);
        $list = [];
        /** @var UserModel $model */
        foreach ($query->get() as $model) {
            $entity = ContactUserFactory::createByModel($model);
            $list[$entity->getUserId()] = $entity;
        }
        return $list;
    }

    /**
     * @return string[]
     */
    public function getUserOrganizations(string $userId): array
    {
        $userEntity = $this->getUserById($userId);
        if ($userEntity === null) {
            return [];
        }

        $magicId = $userEntity->getMagicId();

        // 第二次查询：根据 magic_id 查询所有该账号在不同组织中的用户记录
        $query = $this->userModel::query()
            ->select('organization_code')
            ->where('magic_id', $magicId)
            ->where('status', AccountStatus::Normal->value)
            ->distinct();

        $results = Db::select($query->toSql(), $query->getBindings());

        return array_column($results, 'organization_code');
    }

    /**
     * 根据 magicId 获取用户所属的组织列表.
     * @return string[]
     */
    public function getUserOrganizationsByMagicId(string $magicId): array
    {
        $query = $this->userModel::query()
            ->select('organization_code')
            ->where('magic_id', $magicId)
            ->where('status', AccountStatus::Normal->value)
            ->distinct();

        $results = Db::select($query->toSql(), $query->getBindings());

        return array_column($results, 'organization_code');
    }

    public function getUserByAiCode(string $aiCode): array
    {
        $user = $this->accountModel::query()
            ->where('ai_code', '=', $aiCode)
            ->whereIn('status', [AccountStatus::Normal->value, AccountStatus::Disable->value]);
        $user = Db::select($user->toSql(), $user->getBindings())[0] ?? null;
        return ! empty($user) ? $user : [];
    }

    public function searchByKeyword(string $keyword): array
    {
        if (empty($keyword)) {
            return [[], []];
        }
        // 最受欢迎
        $popular = $this->userModel::query()
            ->where('status', AccountStatus::Normal->value)
            ->where('user_type', UserType::Ai->value)
            ->where('like_num', '>', 0)
            ->where(function ($query) use ($keyword) {
                $query->where('nickname', 'like', "%{$keyword}%")
                    ->orWhere('label', 'like', "%{$keyword}%")
                    ->orWhere('description', 'like', "%{$keyword}%");
            })
            ->orderBy('like_num', 'desc')
            ->limit(3);
        $popular = Db::select($popular->toSql(), $popular->getBindings());
        $popularIds = array_column($popular, 'id');
        // 最新
        $latest = $this->userModel::query()
            ->where('status', AccountStatus::Normal->value)
            ->where('user_type', UserType::Ai->value)
            ->where(function ($query) use ($keyword) {
                $query->where('nickname', 'like', "%{$keyword}%")
                    ->orWhere('label', 'like', "%{$keyword}%")
                    ->orWhere('description', 'like', "%{$keyword}%");
            })
            ->whereNotIn('user_id', $popularIds)
            ->orderBy('created_at', 'desc')
            ->limit(3);
        $latest = Db::select($latest->toSql(), $latest->getBindings());
        // todo 统计好友数量
        return [$popular, $latest];
    }

    public function insertUser(array $userInfo): void
    {
        $userInfo['extra'] = $userInfo['extra'] ?? '';
        $this->userModel::query()->create($userInfo);
    }

    public function getUserByMobile(string $mobile): ?array
    {
        $user = $this->userModel::query()
            ->where('mobile', $mobile)
            ->where('status', 1);
        $user = Db::select($user->toSql(), $user->getBindings())[0] ?? null;
        return ! empty($user) ? $user : null;
    }

    public function getUserByMobileWithStateCode(string $stateCode, string $mobile): ?array
    {
        $user = $this->userModel::query()
            ->where('mobile', $mobile)
            ->where('state_code', $stateCode)
            ->where('status', 0);
        $user = Db::select($user->toSql(), $user->getBindings())[0] ?? null;
        return ! empty($user) ? $user : null;
    }

    public function getUserByMobilesWithStateCode(string $stateCode, array $mobiles): array
    {
        $query = $this->userModel::query()
            ->whereIn('mobile', $mobiles)
            ->where('state_code', $stateCode)
            ->where('status', 1);
        return Db::select($query->toSql(), $query->getBindings());
    }

    public function getUserByMobiles(array $mobiles): array
    {
        $query = $this->userModel::query()
            ->whereIn('mobile', $mobiles)
            ->where('status', 1);
        return Db::select($query->toSql(), $query->getBindings());
    }

    #[CacheEvict(prefix: 'userEntity', value: '_#{userId}')]
    public function updateDataById(string $userId, array $data): int
    {
        $data['updated_at'] = date('Y-m-d H:i:s');
        $data['deleted_at'] = null;
        unset($data['created_at']);
        return $this->userModel::query()
            ->where('user_id', $userId)
            ->update($data);
    }

    public function deleteUserByIds(array $ids): int
    {
        return $this->userModel::query()
            ->whereIn('user_id', $ids)
            ->delete();
    }

    public function getUserByAccountAndOrganization(string $accountId, string $organizationCode): ?MagicUserEntity
    {
        $user = $this->getUserArrayByAccountAndOrganization($accountId, $organizationCode);
        return $user ? UserAssembler::getUserEntity($user) : null;
    }

    public function getUserByAccountsAndOrganization(array $accountIds, string $organizationCode): array
    {
        $query = $this->userModel::query()
            ->whereIn('magic_id', $accountIds)
            ->where('organization_code', $organizationCode);
        return Db::select($query->toSql(), $query->getBindings());
    }

    public function getUserByAccountsInMagic(array $accountIds): array
    {
        $query = $this->userModel::query()->whereIn('magic_id', $accountIds);
        return Db::select($query->toSql(), $query->getBindings());
    }

    public function searchByNickName(string $nickName, string $organizationCode): array
    {
        if (empty($nickName)) {
            return [];
        }
        $query = $this->userModel::query()
            ->where('organization_code', $organizationCode)
            ->where('nickname', 'like', "%{$nickName}%");
        return Db::select($query->toSql(), $query->getBindings());
    }

    public function searchByNickNameInMagic(string $nickName): array
    {
        if (empty($nickName)) {
            return [];
        }
        $query = $this->userModel::query()->where('nickname', 'like', "%{$nickName}%");
        return Db::select($query->toSql(), $query->getBindings());
    }

    public function getUserByIds(array $ids): array
    {
        $query = $this->userModel::query()->whereIn('user_id', $ids);
        return Db::select($query->toSql(), $query->getBindings());
    }

    public function getUserIdByType(UserIdType $userIdType, string $addStr): string
    {
        $uniqueId = IdGenerator::getUniqueId32();
        $randomStr = md5(sprintf('%s_%s', $addStr, $uniqueId));
        $prefix = $userIdType->getPrefix();
        return sprintf('%s_%s', $prefix, $randomStr);
    }

    #[CacheEvict(prefix: 'userEntity', value: '_#{userDTO.userId}')]
    public function saveUser(MagicUserEntity $userDTO): MagicUserEntity
    {
        $user = $this->getUserById($userDTO->getUserId());
        if ($user === null) {
            // 创建
            return $this->createUser($userDTO);
        }
        // 更新
        $userData = $userDTO->toArray();
        // 移除为 null 的数据
        foreach ($userData as $key => $value) {
            if ($value === null) {
                unset($userData[$key]);
            }
        }
        $this->updateDataById($userDTO->getUserId(), $userData);
        // 返回最新数据
        return $this->getUserById($userDTO->getUserId());
    }

    public function addUserManual(string $userId, string $userManual): void
    {
        $this->userModel::query()
            ->where('user_id', $userId)
            ->update(['user_manual' => $userManual]);
    }

    /**
     * @return MagicUserEntity[]
     */
    public function getUsersByMagicIdAndOrganizationCode(array $magicIds, string $organizationCode): array
    {
        $users = $this->userModel::query()
            ->whereIn('magic_id', $magicIds)
            ->where('organization_code', $organizationCode);
        $users = Db::select($users->toSql(), $users->getBindings());
        $userEntities = [];
        foreach ($users as $user) {
            $userEntities[] = UserAssembler::getUserEntity($user);
        }
        return $userEntities;
    }

    /**
     * @return MagicUserEntity[]
     */
    public function getUserByMagicIds(array $magicIds): array
    {
        $users = $this->userModel::query()->whereIn('magic_id', $magicIds);
        $users = Db::select($users->toSql(), $users->getBindings());
        $userEntities = [];
        foreach ($users as $user) {
            $userEntities[] = UserAssembler::getUserEntity($user);
        }
        return $userEntities;
    }

    /**
     * @return MagicUserEntity[]
     */
    public function getUserAllUserIds(string $userId): array
    {
        $user = $this->getUserById($userId);
        if ($user === null) {
            return [];
        }
        $users = $this->userModel::query()->where('magic_id', $user->getMagicId());
        $users = Db::select($users->toSql(), $users->getBindings());
        $userEntities = [];
        foreach ($users as $user) {
            $userEntities[] = UserAssembler::getUserEntity($user);
        }
        return $userEntities;
    }

    public function updateUserOptionByIds(array $ids, ?UserOption $userOption = null): int
    {
        $data['updated_at'] = date('Y-m-d H:i:s');
        $data['option'] = $userOption?->value;
        return $this->userModel::query()
            ->whereIn('user_id', $ids)
            ->update($data);
    }

    public function getMagicIdsByUserIds(array $userIds): array
    {
        return UserModel::query()->whereIn('user_id', $userIds)->pluck('magic_id')->toArray();
    }

    // 避免 redis 缓存序列化的对象,占用太多内存
    #[Cacheable(prefix: 'userEntity', value: '_#{id}', ttl: 60)]
    private function getUser(string $id): ?array
    {
        $query = $this->userModel::query()
            ->where('user_id', $id)
            ->where('status', AccountStatus::Normal->value);
        return Db::select($query->toSql(), $query->getBindings())[0] ?? null;
    }

    // 避免 redis 缓存序列化的对象,占用太多内存
    #[Cacheable(prefix: 'userAccount', ttl: 60)]
    private function getUserArrayByAccountAndOrganization(string $accountId, string $organizationCode): ?array
    {
        $query = $this->userModel::query()
            ->where('magic_id', $accountId)
            ->where('organization_code', $organizationCode);
        return Db::select($query->toSql(), $query->getBindings())[0] ?? null;
    }

    /**
     * 投递初始化默认助手会话事件到MQ.
     */
    private function publishInitDefaultAssistantConversationEventForMQ(MagicUserEntity $userEntity): void
    {
        $initDefaultAssistantConversationEvent = new InitDefaultAssistantConversationEvent(
            $userEntity,
        );
        $initDefaultAssistantConversationMq = new InitDefaultAssistantConversationDispatchPublisher($initDefaultAssistantConversationEvent);
        if (! $this->producer->produce($initDefaultAssistantConversationMq)) {
            $this->logger->error(sprintf(
                'publishInitDefaultAssistantConversationEventForMQ, pushMessage failed, message:%s',
                Json::encode($initDefaultAssistantConversationEvent),
            ));
            ExceptionBuilder::throw(ChatErrorCode::MESSAGE_DELIVERY_FAILED);
        }
    }

    private function getExtraString(?UserExtra $userExtra): string
    {
        if ($userExtra === null) {
            return '';
        }
        return Json::encode($userExtra);
    }
}
