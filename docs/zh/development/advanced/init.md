# Magic Service 系统初始化操作指南

本文档简要描述了 Magic Service 系统的初始化操作步骤，包括账号和用户数据填充、环境配置以及登录验证功能的实现。

## 1. 账号和用户数据初始化

系统使用数据填充器 `seeders/initial_account_and_user_seeder.php` 来初始化账号和用户数据，主要完成以下任务：

- 创建不少于2个人类账号记录到 `magic_contact_accounts` 表
- 为每个账号在2个不同组织下创建用户数据
- 使用 `App\Infrastructure\Util\IdGenerator` 自动生成 magic_id
- 实现数据重复检查以避免重复创建

## 2. 环境配置初始化

系统使用数据填充器 `seeders/initial_environment_seeder.php` 来初始化环境配置数据，主要完成以下任务：

- 写入生产环境配置，包含部署类型、环境类型、私有配置等信息
- 写入测试环境配置，便于开发和测试

> **重要：** 系统生产环境 ID 为 10000，请确保在环境变量中将 `MAGIC_ENV_ID` 设置为 `10000`。

## 3. 执行和测试步骤

### 3.1 运行数据填充

执行以下命令填充账号和环境数据：

```bash
php bin/hyperf.php db:seed --path=seeders/initial_account_and_user_seeder.php
php bin/hyperf.php db:seed --path=seeders/initial_environment_seeder.php
```

### 3.2 重启服务

加载新的路由配置：

```bash
php bin/hyperf.php server:restart
```

### 3.3 测试登录功能

使用以下命令测试登录接口：

```bash
curl -X POST -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"138001","organization_code":""}' http://localhost:9501/api/v1/login/check
```

## 4. 密码说明

本实现中使用 `letsmagic.ai` 默认密码：
- 账号 `13812345678`：密码为 `letsmagic.ai`
- 账号 `13912345678`：密码为 `letsmagic.ai`

在生产环境中，请确保实现安全的密码存储和验证机制。 
