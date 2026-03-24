## 快速开始

支持 macOS 和 Linux。即将支持Windows。

### 类 UNIX 系统（macOS 和 Linux）

#### 前置要求

- Linux 内核 3.2 及以上 / macOS 12 Monterey 及以上（运行 Magicrew CLI需要）
- 已安装并正常运行的 [Docker](https://www.docker.com/)
- curl（用于获取一键部署脚本）

### 使用脚本一键部署 Magicrew

```bash
curl -fsSL https://getmagicrew.sh | bash
```

这个脚本也可从 `https://dtyq.github.io/artifacts/bootstrap/latest/install.sh` 获取。

脚本会拉取 [Magicrew CLI](https://github.com/dtyq/magic/tree/master/cli) 的最新发布版本，并用它部署 Magicrew。

请等待安装完成。根据网络情况，这可能需要很长时间。

安装完成后，安装程序会展示如下信息：

```bash
[2026-03-24 01:46:39.285][I][deploy] [print summary]...

✓ Deployment complete!
  Access magic-web: http://localhost:38080
  To access from another machine, set MAGIC_WEB_BASE_URL, e.g. export MAGIC_WEB_BASE_URL=http://your-server:38080

To remove the cluster, run: magicrew teardown
```

安装完成后，可以在 `http://localhost:38080` 访问 Magicrew。

### 手动部署

**TODO** 补充手动部署说明

由于我们通过 Kubernetes 实现完整的沙箱支持，Magicrew 现在只能部署在 Kubernetes 上。对不熟悉 Kubernetes 的用户而言，这可能有亿点点难度。未来我们可能会提供友好的部署指南。

## Windows

即将支持。
