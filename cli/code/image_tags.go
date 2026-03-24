package code

import (
	"errors"
	"fmt"
	"strings"
	"time"
)

func (c *Code) GenerateImageTags(policy string) ([]string, error) {
	var errs []error
	tagsMap := map[string]struct{}{}

	policies := strings.Split(policy, ",")
	for _, policy := range policies {
		switch policy {
		case "latest":
			tagsMap["latest"] = struct{}{}
		case "commit":
			headHash, err := c.GetHEADHash()
			if err != nil {
				errs = append(errs, err)
				break
			}
			tagsMap[headHash] = struct{}{}
		case "nightly-date":
			tagsMap["nightly-"+time.Now().Format("20060102")] = struct{}{}
		case "branch":
			branch, err := c.GetBranch()
			if err != nil {
				errs = append(errs, err)
				break
			}
			tagsMap[branch] = struct{}{}
		case "git-tags":
			var tags []string
			tags, _ = c.GetHEADTags()
			for _, tag := range tags {
				tagsMap[tag] = struct{}{}
			}
		default:
			errs = append(errs, fmt.Errorf("unknown tag policy: %s", policy))
		}

	}

	err := errors.Join(errs...)

	tags := make([]string, 0, len(tagsMap))
	for tag := range tagsMap {
		tags = append(tags, tag)
	}

	return tags, err
}
