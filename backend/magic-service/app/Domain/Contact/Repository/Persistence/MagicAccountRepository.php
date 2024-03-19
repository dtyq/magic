<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Repository\Persistence;

use App\Domain\Contact\Entity\AccountEntity;
use App\Domain\Contact\Repository\Facade\MagicAccountRepositoryInterface;
use App\Domain\Contact\Repository\Persistence\Model\AccountModel;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Chat\Assembler\UserAssembler;
use Hyperf\Cache\Annotation\Cacheable;
use Hyperf\Cache\Annotation\CacheEvict;
use Hyperf\DbConnection\Db;

readonly class MagicAccountRepository implements MagicAccountRepositoryInterface
{
    public function __construct(
        protected AccountModel $accountModel,
    ) {
    }

    public function getAccountInfoByMagicId(string $magicId): ?AccountEntity
    {
        $account = $this->getAccountInfo($magicId);
        if ($account === null) {
            return null;
        }
        return UserAssembler::getAccountEntity($account);
    }

    /**
     * @return AccountEntity[]
     */
    public function getAccountByMagicIds(array $magicIds): array
    {
        $accounts = AccountModel::query()->whereIn('magic_id', $magicIds);
        $accounts = Db::select($accounts->toSql(), $accounts->getBindings());
        $data = [];
        foreach ($accounts as $account) {
            $accountEntity = UserAssembler::getAccountEntity($account);
            $data[$accountEntity->getMagicId()] = $accountEntity;
        }
        return $data;
    }

    public function createAccount(AccountEntity $accountDTO): AccountEntity
    {
        $time = date('Y-m-d H:i:s');
        $accountDTO = $this->createAccountCheck($accountDTO);
        $this->accountModel::query()->create([
            'id' => $accountDTO->getId(),
            'magic_id' => $accountDTO->getMagicId(),
            'type' => $accountDTO->getType()->value,
            'ai_code' => $accountDTO->getAiCode(),
            'status' => $accountDTO->getStatus()->value,
            'country_code' => $accountDTO->getCountryCode(),
            'phone' => $accountDTO->getPhone(),
            'email' => $accountDTO->getEmail(),
            'real_name' => $accountDTO->getRealName(),
            'password' => $accountDTO->getPassword(),
            'created_at' => $time,
            'updated_at' => $time,
        ]);
        return $accountDTO;
    }

    /**
     * @param AccountEntity[] $accountDTOs
     * @return AccountEntity[]
     */
    public function createAccounts(array $accountDTOs): array
    {
        $data = [];
        $accountEntities = [];
        $time = date('Y-m-d H:i:s');
        foreach ($accountDTOs as $accountDTO) {
            $accountDTO = $this->createAccountCheck($accountDTO);
            $accountDTO->setCreatedAt($time);
            $accountDTO->setUpdatedAt($time);
            $accountDTO->setDeletedAt(null);
            $data[] = $accountDTO->toArray();
            $accountEntities[] = $accountDTO;
        }
        $this->accountModel::query()->insert($data);
        return $accountEntities;
    }

    /**
     * @return AccountEntity[]
     */
    public function getAccountInfoByMagicIds(array $magicIds): array
    {
        $query = $this->accountModel::query()->whereIn('magic_id', $magicIds);
        $accounts = Db::select($query->toSql(), $query->getBindings());
        return UserAssembler::getAccountEntities($accounts);
    }

    public function getAccountInfoByAiCode(string $aiCode): ?AccountEntity
    {
        $account = $this->getAccountArrayByAiCode($aiCode);
        if ($account === null) {
            return null;
        }
        return UserAssembler::getAccountEntity($account);
    }

    /**
     * @return AccountEntity[]
     */
    public function searchUserByPhoneOrRealName(string $query): array
    {
        if (empty($query)) {
            return [];
        }
        $sqlQuery = $this->accountModel::query();
        // 判断 $query 是否全部是中文,或者长度大于3
        if (preg_match('/^[\x{4e00}-\x{9fa5}]+$/u', $query) || strlen($query) > 3) {
            $sqlQuery->where('real_name', 'like', "%{$query}%");
        }
        $sqlQuery->orwhere('phone', '=', $query);
        $accounts = Db::select($sqlQuery->toSql(), $sqlQuery->getBindings());
        return UserAssembler::getAccountEntities($accounts);
    }

    #[CacheEvict(prefix: 'accountMagicId', value: '_#{magicId}')]
    public function updateAccount(string $magicId, array $updateData): int
    {
        $time = date('Y-m-d H:i:s');
        $updateData['updated_at'] = $time;
        $updateData['deleted_at'] = null;
        unset($updateData['created_at'], $updateData['id']);
        return $this->accountModel::query()->where('magic_id', $magicId)->update($updateData);
    }

    #[CacheEvict(prefix: 'accountMagicId', value: '_#{accountDTO.magicId}')]
    public function saveAccount(AccountEntity $accountDTO): AccountEntity
    {
        $account = $this->getMagicEntityWithoutCache($accountDTO->getMagicId());
        // 不存在则创建
        if (! $account) {
            return $this->createAccount($accountDTO);
        }
        // 更新
        $accountData = $accountDTO->toArray();
        $this->updateAccount($accountDTO->getMagicId(), $accountData);
        # 防止 $accountDTO 中参数不全,再查一次库
        return $this->getMagicEntityWithoutCache($accountDTO->getMagicId());
    }

    /**
     * @return AccountEntity[]
     */
    public function getAccountInfoByAiCodes(array $aiCodes): array
    {
        $accounts = $this->accountModel::query()->whereIn('ai_code', $aiCodes);
        $accounts = Db::select($accounts->toSql(), $accounts->getBindings());
        return array_map(static fn (array $account) => UserAssembler::getAccountEntity($account), $accounts);
    }

    public function getByAiCode(string $aiCode): ?AccountEntity
    {
        $model = AccountModel::query()->where('ai_code', $aiCode);
        $model = Db::select($model->toSql(), $model->getBindings())[0] ?? null;
        if (empty($model)) {
            return null;
        }
        return UserAssembler::getAccountEntity($model);
    }

    /**
     * 通过手机号获取 magic_id.
     * @param PermissionDataIsolation $dataIsolation 数据隔离（用于环境隔离）
     * @param string $phone 手机号
     * @return null|string magic_id，不存在时返回null
     */
    public function getMagicIdByPhone(PermissionDataIsolation $dataIsolation, string $phone): ?string
    {
        $query = $this->accountModel::query()
            ->select('magic_id')
            ->where('phone', $phone)
            ->where('magic_environment_id', $dataIsolation->getEnvId());

        $result = Db::select($query->toSql(), $query->getBindings())[0] ?? null;
        return $result['magic_id'] ?? null;
    }

    /**
     * 通过手机号获取所有 magic_id（一个手机号可能对应多个账号）.
     * @param string $phone 手机号
     * @return string[] magic_id 数组
     */
    public function getMagicIdsByPhone(string $phone): array
    {
        $query = $this->accountModel::query()
            ->select('magic_id')
            ->where('phone', $phone);

        $results = Db::select($query->toSql(), $query->getBindings());
        return array_column($results, 'magic_id');
    }

    private function createAccountCheck(AccountEntity $accountDTO): AccountEntity
    {
        if (empty($accountDTO->getMagicId())) {
            ExceptionBuilder::throw(UserErrorCode::ACCOUNT_ERROR);
        }
        if ($accountDTO->getId() === null) {
            $id = IdGenerator::getSnowId();
            $accountDTO->setId($id);
        }
        return $accountDTO;
    }

    private function getMagicEntityWithoutCache(string $magicId): ?AccountEntity
    {
        # 防止 $accountDTO 中参数不全,再查一次库
        $account = $this->accountModel::query()->where('magic_id', $magicId);
        $account = Db::select($account->toSql(), $account->getBindings())[0] ?? null;
        if (empty($account)) {
            return null;
        }
        return UserAssembler::getAccountEntity($account);
    }

    // 避免 redis 缓存序列化的对象,占用太多内存
    #[Cacheable(prefix: 'accountMagicId', ttl: 60)]
    private function getAccountInfo(string $magicId): ?array
    {
        $query = $this->accountModel::query()->where('magic_id', $magicId);
        return Db::select($query->toSql(), $query->getBindings())[0] ?? null;
    }

    // 避免 redis 缓存序列化的对象,占用太多内存
    #[Cacheable(prefix: 'accountAiCode', ttl: 60)]
    private function getAccountArrayByAiCode(string $aiCode): ?array
    {
        $query = $this->accountModel::query()->where('ai_code', $aiCode);
        return Db::select($query->toSql(), $query->getBindings())[0] ?? null;
    }
}
