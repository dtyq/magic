## Quick Start
Supports macOS and Linux. Windows is coming soon.

### UNIX-like

#### Prerequisites

- Linux kernel version 3.2 or later / macOs 12 Monterey or later (for running the Magicrew CLI)
- Working [Docker](https://www.docker.com/)
- curl (for retrieving the one-line deployment script)

### One-line script to deploy Magicrew

```bash
curl -fsSL https://getmagicrew.sh | bash
```

The script is also located at `https://dtyq.github.io/artifacts/bootstrap/latest/install.sh`

The script will fetch the latest release of [Magicrew CLI](https://github.com/dtyq/magic/tree/master/cli) and use it to deploy Magicrew.

Wait for the installation to complete. This may take a few minutes depending on your network speed.

After the installation is complete, the installer will show you the following message:

```bash
[2026-03-24 01:46:39.285][I][deploy] [print summary]...

✓ Deployment complete!
  Access magic-web: http://localhost:38080
  To access from another machine, set MAGIC_WEB_BASE_URL, e.g. export MAGIC_WEB_BASE_URL=http://your-server:38080

To remove the cluster, run: magicrew teardown
```

You can now access the web interface at http://localhost:38080 to use Magicrew.

### Manual deployment

**TODO** Add manual deployment instructions here.

Since we have implemented full sandbox support with Kubernetes, Magicrew can only be deployed on Kubernetes. This may be a tough task for users who are not familiar with Kubernetes. We may provide a user-friendly deployment guide in the future.

## Windows

Coming soon.
