# gh-label-sync

Simple CLI utility to ensure that a base set of issue labels are configured in one or more GitHub repositories.

## Setup

After cloning the repo install the necessary dependencies
```
npm install
```
and build the typescript code
```
npm run build
```

## Running the tool

Once the code has been built we can run the tool either using directly nodejs command
```
node . --help
Usage: [-t github_token --dry-run] GITHUB_REPO [GITHUB_REPOS...]

Options:
      --help     Show help                                             [boolean]
      --version  Show version number                                   [boolean]
  -t, --token    Github token used for authentication                   [string]
      --dry-run  Dry-run will output a json file per repo describing the actions
                 that would have been taken           [boolean] [default: false]
```
or using the npm script
```
npm run cli -- --help

> gh-label-sync@0.0.1 cli
> node . "--help"

Usage: [-t github_token --dry-run] GITHUB_REPO [GITHUB_REPOS...]

Options:
      --help     Show help                                             [boolean]
      --version  Show version number                                   [boolean]
  -t, --token    Github token used for authentication                   [string]
      --dry-run  Dry-run will output a json file per repo describing the actions
                 that would have been taken           [boolean] [default: false]
```
Note: the `--` is used to separate the arguments to pass to the script being run from the npm args.

## Synchronizing labels

The purpose of this tool is to ensure that a minimum set of issue labels is configured consistenly in
one or more GitHUb repositories. The set of labels that will be configured along with a set of aliases
to match existing issue labels are defined in [config.json](config.json)

Passing a token we can check and fix issue labels on multiple repositories, for example:
```
node . -t <github token> keptn-contrib/prometheus-service keptn-contrib/job-executor-service keptn-contrib/argo-service keptn-sandbox/keptn-service-template-go keptn-sandbox/keptn-jenkins-library keptn-sandbox/keptn-azure-devops-extension
```

## Previewing changes
It's possible to specify a dry-run to generate a json file for each of the specified repositories
containing the changes that would be performed, for example:
```
node . --dry-run keptn-contrib/prometheus-service
```

## (Optional) Installing the tool locally
The tool can be added to your current nodejs installation by executing:
```
npm install --global .
```
so that it's possible to execute this tool from  anywhere, for example:

```
npm install --global .

added 1 package, and audited 3 packages in 1s

found 0 vulnerabilities
```
then

```
gh-label-sync --help
Usage: [-t github_token --dry-run] GITHUB_REPO [GITHUB_REPOS...]

Options:
      --help     Show help                                             [boolean]
      --version  Show version number                                   [boolean]
  -t, --token    Github token used for authentication                   [string]
      --dry-run  Dry-run will output a json file per repo describing the actions
                 that would have been taken           [boolean] [default: false]

```

To uninstall simply execute
```
npm uninstall --global gh-label-sync
```
