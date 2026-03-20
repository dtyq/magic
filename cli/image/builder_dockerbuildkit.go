package image

import (
	"context"
	"fmt"
	"net"
	"os"
	"strings"

	dockerConfig "github.com/docker/cli/cli/config"
	"github.com/mattn/go-isatty"
	buildkitClient "github.com/moby/buildkit/client"
	"github.com/moby/buildkit/frontend/dockerui"
	"github.com/moby/buildkit/session"
	"github.com/moby/buildkit/session/auth/authprovider"
	"github.com/moby/buildkit/util/progress/progressui"
	mobyClient "github.com/moby/moby/client"
	"github.com/moby/moby/client/pkg/jsonmessage"
	"github.com/tonistiigi/fsutil"
	"go.yaml.in/yaml/v3"
	"golang.org/x/sync/errgroup"

	"github.com/dtyq/magicrew-cli/util"
)

const BuilderKindDockerBuildKit BuilderKind = "dockerBuildkit"

type DockerBuildKitBuilder struct {
	Kind            BuilderKind        `yaml:"kind"`
	ImagePrefix     string             `yaml:"imagePrefix"`
	CommonBuildArgs map[string]*string `yaml:"commonBuildArgs"`
}

func newDockerBuildKitBuilder(node yaml.Node) (*DockerBuildKitBuilder, error) {
	b := DockerBuildKitBuilder{}

	err := node.Decode(&b)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal docker buildkit builder config: %w", err)
	}
	return &b, nil
}

type dockerBuildKitDaemon struct {
	MobyClient         *mobyClient.Client
	BuildkitClient     *buildkitClient.Client
	DockerClientConfig dockerCLIConfig
}

var dockerBuildKitDaemonInstance *dockerBuildKitDaemon

func connectToDockerBuildKitDaemon(ctx context.Context) (*dockerBuildKitDaemon, error) {
	if dockerBuildKitDaemonInstance != nil {
		return dockerBuildKitDaemonInstance, nil
	}

	// create docker client
	client, err := mobyClient.New(
		mobyClient.FromEnv,
	)
	if err != nil {
		return nil, err
	}

	// create buildkit client
	bkc, err := buildkitClient.New(ctx, "",
		buildkitClient.WithSessionDialer(func(ctx context.Context, proto string, meta map[string][]string) (net.Conn, error) {
			return client.DialHijack(ctx, "/session", proto, meta)
		}),
		buildkitClient.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return client.DialHijack(ctx, "/grpc", "h2c", nil)
		}),
	)

	dockerBuildKitDaemonInstance = &dockerBuildKitDaemon{
		MobyClient:     client,
		BuildkitClient: bkc,
	}

	// read docker default config
	dockerClientConfig := dockerConfig.LoadDefaultConfigFile(os.Stderr)
	dockerBuildKitDaemonInstance.DockerClientConfig = dockerCLIConfig{*dockerClientConfig}

	return dockerBuildKitDaemonInstance, nil
}

func (b *DockerBuildKitBuilder) SetOption(option string, value any) error {
	switch option {
	case "imagePrefix":
		imagePrefix, ok := value.(string)
		if !ok {
			return fmt.Errorf("invalid image prefix type: %T", value)
		}
		b.ImagePrefix = imagePrefix
	default:
		return fmt.Errorf("unknown option: %s", option)
	}
	return nil
}

func (b *DockerBuildKitBuilder) Build(ctx context.Context, build Build, buildOptions BuildOptions) (string, error) {
	lg := ctx.Value(util.ContextTypeLoggerGroup{}).(util.LoggerGroup)
	lg.Logi("image", "building image %s using docker buildkit client with prefix \"%s\"", build.Tags, b.ImagePrefix)

	daemon, err := connectToDockerBuildKitDaemon(ctx)
	if err != nil {
		return "", err
	}

	// build image
	// the context fs
	contextFS, _ := fsutil.NewFS(build.Context)

	// the dockerfile path
	dockerFilePath := build.Dockerfile
	if dockerFilePath == "" {
		dockerFilePath = "Dockerfile"
	}
	frontendOptions := map[string]string{
		"platform": build.StringListPlatforms(),
		"filename": dockerFilePath,
	}
	if buildOptions.NoCache {
		frontendOptions["no-cache"] = ""
	}
	if buildOptions.Pull {
		frontendOptions["image-resolve-mode"] = "pull"
	}

	// the build args
	buildArgs := make(map[string]*string)
	for k, v := range b.CommonBuildArgs {
		buildArgs[k] = v
	}
	for k, v := range build.BuildArgs {
		buildArgs[k] = v
	}
	for k, v := range daemon.DockerClientConfig.getExtraBuildArgs() {
		buildArgs[k] = v
	}
	for k, v := range buildArgs {
		frontendOptions["build-arg:"+k] = *v
	}

	// the image names and export
	imageNames := make([]string, len(build.Tags))
	for i, tag := range build.Tags {
		imageNames[i] = b.ImagePrefix + tag
	}
	export := buildkitClient.ExportEntry{
		Type: "moby",
		Attrs: map[string]string{
			"name": strings.Join(imageNames, ","),
		},
	}

	// make attachable
	attachable := []session.Attachable{
		authprovider.NewDockerAuthProvider(authprovider.DockerAuthProviderConfig{
			AuthConfigProvider: authprovider.LoadAuthConfig(&daemon.DockerClientConfig.ConfigFile),
		}),
	}

	// make solve options
	solveOpt := buildkitClient.SolveOpt{
		Frontend:      "dockerfile.v0",
		FrontendAttrs: frontendOptions,
		LocalMounts: map[string]fsutil.FS{
			dockerui.DefaultLocalNameContext:    contextFS,
			dockerui.DefaultLocalNameDockerfile: contextFS, // Dockerfile 和 context 同目录
		},
		Exports: []buildkitClient.ExportEntry{export},
		Session: attachable,
	}

	// show progress
	d, err := progressui.NewDisplay(os.Stderr, buildOptions.ProgressMode)
	if err != nil {
		return "", err
	}
	statusChan := make(chan *buildkitClient.SolveStatus)

	eg, solveCtx := errgroup.WithContext(ctx)

	eg.Go(func() error {
		_, err := d.UpdateFrom(context.TODO(), statusChan)
		return err
	})

	var resp *buildkitClient.SolveResponse
	eg.Go(func() error {
		var err error
		resp, err = daemon.BuildkitClient.Solve(solveCtx, nil, solveOpt, statusChan)
		return err
	})
	if err := eg.Wait(); err != nil {
		return "", fmt.Errorf("failed to build: %w", err)
	}

	imageID := resp.ExporterResponse["containerimage.digest"]
	lg.Logi("image", "built image: %s", imageID)

	if buildOptions.Push {
		err := b.Push(ctx, build)
		if err != nil {
			return "", fmt.Errorf("failed to push: %w", err)
		}
	}
	return imageID, nil
}

func (b *DockerBuildKitBuilder) Push(ctx context.Context, build Build) error {
	lg := ctx.Value(util.ContextTypeLoggerGroup{}).(util.LoggerGroup)
	lg.Logi("image", "pushing image %s using docker with prefix %s", build.Tags, b.ImagePrefix)

	daemon, err := connectToDockerBuildKitDaemon(ctx)
	if err != nil {
		return err
	}

	for _, tag := range build.Tags {
		registry := "docker.io"
		imageParts := strings.Split(tag, "/")
		if len(imageParts) > 1 {
			registry = imageParts[0]
		}

		registryAuth, _ := daemon.DockerClientConfig.GetAuthConfig(registry)

		tag = b.ImagePrefix + tag
		resp, err := daemon.MobyClient.ImagePush(ctx, tag, mobyClient.ImagePushOptions{
			RegistryAuth: registryAuth.Auth,
		})
		if err != nil {
			return fmt.Errorf("failed to push image %s: %v", tag, err)
		}
		defer resp.Close()
		err = jsonmessage.DisplayJSONMessagesStream(
			resp,
			os.Stdout,
			os.Stdout.Fd(),
			isatty.IsTerminal(os.Stdout.Fd()),
			nil,
		)
		if err != nil {
			return fmt.Errorf("failed to push image %s: %v", tag, err)
		}
	}
	return nil
}
