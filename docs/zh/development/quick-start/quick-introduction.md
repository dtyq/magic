# 🎩 Magic - 新一代企业级 AI 应用创新引擎

<div align="center">

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
<!-- [![Docker Pulls](https://img.shields.io/docker/pulls/dtyq/magic.svg)](https://hub.docker.com/r/dtyq/magic) -->
<!-- [![GitHub stars](https://img.shields.io/github/stars/dtyq/magic.svg?style=social&label=Star)](https://github.com/dtyq/magic) -->

</div>

Magic 是一个强大的企业级 AI 应用创新引擎，旨在帮助开发者快速构建和部署 AI 应用。它提供了完整的开发框架、丰富的工具链和最佳实践，让 AI 应用的开发变得简单而高效。
![flow](https://cdn.letsmagic.cn/static/img/showmagic.jpg)


## ✨ 特性

- 🚀 **高性能架构**：基于 PHP+Swow+hyperf 开发，提供卓越的性能和可扩展性
- 🧩 **模块化设计**：灵活的插件系统，支持快速扩展和定制
- 🔌 **多模型支持**：无缝集成主流 AI 模型，包括 GPT、Claude、Gemini 等
- 🛠️ **开发工具链**：完整的开发、测试、部署工具链
- 🔒 **企业级安全**：完善的安全机制，支持组织架构和权限管理

## 🚀 快速开始

### 系统要求
- Docker 24.0+
- Docker Compose 2.0+

### 安装

```bash
# 克隆仓库
git clone https://github.com/dtyq/magic.git
cd magic

# 启动服务
./bin/magic.sh start
```

### 使用 Docker

```bash
# 前台启动服务
./bin/magic.sh start

# 后台启动服务
./bin/magic.sh daemon

# 查看服务状态
./bin/magic.sh status

# 查看日志
./bin/magic.sh logs
```


##### 配置环境变量

```bash
# 配置magic 环境变量, 必须配置任意一种大模型的环境变量才可正常使用magic
cp .env.example .env


# 配置超级麦吉 环境变量,必须配置任意一种支持openai 格式的大模型环境变量, 才可正常使用使用
./bin/magic.sh status
cp config/.env_super_magic.example .env_super_magic

```


### 访问服务
- API 服务: http://localhost:9501
- Web 应用: http://localhost:8080
  - 账号 `13812345678`：密码为 `letsmagic.ai`
  - 账号 `13912345678`：密码为 `letsmagic.ai`
- RabbitMQ 管理界面: http://localhost:15672
  - 用户名: admin
  - 密码: magic123456




## 🤝 贡献

我们欢迎各种形式的贡献，包括但不限于：

- 提交问题和建议
- 改进文档
- 提交代码修复
- 贡献新功能



## 📄 许可证

Magic 使用 [Apache License 2.0](LICENSE) 许可证。

## 📞 联系我们

- 邮箱：bd@dtyq.com
- 官网：https://www.letsmagic.cn

## 🙏 致谢

感谢所有为 Magic 做出贡献的开发者！

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=dtyq/magic&type=Date)](https://star-history.com/#dtyq/magic&Date)

</div>
