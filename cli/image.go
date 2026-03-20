package cli

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/dtyq/magicrew-cli/code"
	"github.com/dtyq/magicrew-cli/i18n"
	"github.com/dtyq/magicrew-cli/image"
	"github.com/moby/buildkit/util/progress/progressui"
	"github.com/spf13/cobra"
)

var (
	imageCmd = &cobra.Command{
		Use:   "image",
		Short: i18n.L("imageCommandShort"),
		Run: func(cmd *cobra.Command, args []string) {
			cmd.Help()
		},
	}

	imageBuildCmd = &cobra.Command{
		Use:   "build",
		Short: i18n.L("imageBuildCommandShort"),
		RunE: func(cmd *cobra.Command, args []string) error {
			code, err := code.FindMagicrew(".")
			if err != nil {
				lg.Loge("image", "failed to find magicrew: %v", err)
				return fmt.Errorf("failed to find magicrew: %v", err)
			}

			err = code.Chdir()
			if err != nil {
				lg.Loge("image", "failed to chdir to magicrew: %v", err)
				return fmt.Errorf("failed to chdir to magicrew: %v", err)
			}

			magicrewStructure, err := code.ReadStructure()
			if err != nil {
				lg.Loge("image", "failed to read magicrew structure: %v", err)
				return fmt.Errorf("failed to read magicrew structure: %v", err)
			}

			builder, err := image.NewBuilder(cfg.ImageBuilder)
			if err != nil {
				lg.Loge("image", "failed to create builder: %v", err)
				return fmt.Errorf("failed to create builder: %v", err)
			}

			if cmd.Flags().Changed("imagePrefix") {
				imagePrefix, _ := cmd.Flags().GetString("imagePrefix")
				err := builder.SetOption("imagePrefix", imagePrefix)
				if err != nil {
					lg.Logw("image", "builder donot accept option \"imagePrefix\": %v", err)
				}
			}

			names := args
			if len(names) == 0 {
				// build all images
				lg.Logi("image", "%s", i18n.L("imageBuildCommandBuildingAllImages"))
				for name := range magicrewStructure.Images {
					names = append(names, name)
				}
			}

			pathImageMap := make(map[string]struct {
				name string
				img  image.Build
			})
			for name, img := range magicrewStructure.Images {
				pathImageMap[img.Context] = struct {
					name string
					img  image.Build
				}{name: name, img: img}
			}

			for _, name := range names {
				img, ok := magicrewStructure.Images[name]
				if !ok {
					// try to find image by context path
					imageInfo, ok := pathImageMap[name]
					if !ok {
						lg.Loge("image", "%s", i18n.L("imageBuildCommandImageNotFound", name))
						return fmt.Errorf("image %s not found", name)
					} else {
						name = imageInfo.name
						img = imageInfo.img
					}
				}
				// build image
				if len(img.Tags) == 0 {
					// if img.Tags is empty, use tag policy to generate tags
					// otherwise, use img.Tags
					tagsPolicy, _ := cmd.Flags().GetString("tags-policy")
					if tagsPolicy == "" {
						tagsPolicy = "latest"
					}
					tags, err := code.GenerateImageTags(tagsPolicy)
					if err != nil {
						lg.Loge("image", "failed to generate image tags: %v", err)
						return fmt.Errorf("failed to generate image tags: %v", err)
					}

					img.Tags = make([]string, len(tags))
					for i, tag := range tags {
						img.Tags[i] = name + ":" + tag
					}
				}

				dockerfilePath := img.Dockerfile
				if dockerfilePath == "" {
					dockerfilePath = "Dockerfile"
				}
				dockerfileContent, err := os.ReadFile(filepath.Join(img.Context, dockerfilePath))
				if err != nil {
					lg.Logw("image", "%s", i18n.L("imageBuildCommandFailedToReadDockerfile", err))
				} else {
					if bytes.Contains(dockerfileContent, []byte("CI_COMMIT_SHA")) {
						// pass CI_COMMIT_SHA to builder
						ciCommitSHA, err := code.GetHEADHash()
						if err != nil || ciCommitSHA == "" {
							lg.Logw("image", "%s", i18n.L("imageBuildCommandFailedToGetCommitHash", err))
						} else {
							if img.BuildArgs == nil {
								img.BuildArgs = make(map[string]*string)
							}
							img.BuildArgs["CI_COMMIT_SHA"] = &ciCommitSHA
						}
					}
					if bytes.Contains(dockerfileContent, []byte("CI_COMMIT_TAG")) {
						// pass CI_COMMIT_SHA to builder
						ciCommitTags, err := code.GetHEADTags()
						if err != nil {
							lg.Logw("image", "%s", i18n.L("imageBuildCommandFailedToGetCommitTags", err))
						} else {
							if len(ciCommitTags) > 0 {
								if img.BuildArgs == nil {
									img.BuildArgs = make(map[string]*string)
								}
								img.BuildArgs["CI_COMMIT_TAG"] = &ciCommitTags[0]
							}
						}
					}
				}

				push, _ := cmd.Flags().GetBool("push")
				pull, _ := cmd.Flags().GetBool("pull")
				noCache, _ := cmd.Flags().GetBool("no-cache")
				progressMode, _ := cmd.Flags().GetString("progress")
				_, err = builder.Build(commandContext, img, image.BuildOptions{
					Push:         push,
					Pull:         pull,
					NoCache:      noCache,
					ProgressMode: progressui.DisplayMode(progressMode),
				})
				if err != nil {
					lg.Loge("image", "%s", i18n.L("imageBuildCommandFailedToBuildImage", name, err))
					return fmt.Errorf("failed to build image %s: %v", name, err)
				}
			}
			return nil
		},
	}
)

func init() {
	rootCmd.AddCommand(imageCmd)

	imageBuildCmd.Flags().String("tags-policy", "", i18n.L("imageBuildCommandTagsPolicyHelp", time.Now().Format("20060102")))
	imageBuildCmd.Flags().BoolP("push", "p", false, i18n.L("imageBuildCommandPushHelp"))
	imageBuildCmd.Flags().Bool("pull", false, i18n.L("imageBuildCommandPullHelp"))
	imageBuildCmd.Flags().Bool("no-cache", false, i18n.L("imageBuildCommandNoCacheHelp"))
	imageBuildCmd.Flags().String("imagePrefix", "", i18n.L("imageBuildCommandImagePrefixHelp"))
	imageBuildCmd.Flags().String("progress", "", i18n.L("imageBuildCommandProgressModeHelp"))

	imageCmd.AddCommand(imageBuildCmd)
}
