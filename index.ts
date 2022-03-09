#!/usr/bin/env node

import { Octokit } from "octokit";
import { writeFileSync } from "fs";
import yargs from "yargs";
import * as config from "./config.json";

interface Label {
  name: string;
  color: string;
  description: string | null;
}

interface Config {
  desiredLabels: Label[];
}

type LabelRetriever = (owner: string, repo: string) => Promise<Label[]>;

type SyncPlanAction = (plan: SyncPlan) => Promise<any>;

class SyncPlan {
  private _labelsToCreate: Label[] = [];
  private _labelsToUpdate: Map<string, Label> = new Map<string, Label>();

  constructor(readonly owner: string, readonly repository: string) {}

  addLabelToCreate(label: Label) {
    this._labelsToCreate.push(Object.assign({}, label));
  }

  addLabelToUpdate(existingLabel: Label, update: Label) {
    this._labelsToUpdate.set(existingLabel.name, update);
  }

  get labelsToCreate() {
    return this._labelsToCreate;
  }

  get labelsToUpdate() {
    return this._labelsToUpdate;
  }
}

interface LabelMatcher {
  findMatches(labelToMatch: Label, labels: Label[]): Label[];
}

interface CandidateNamesGenerator {
  generateCandidateNames(labelName: string): string[];
}

class IdentityCandidateNamesGenerator implements CandidateNamesGenerator {
  generateCandidateNames(labelName: string): string[] {
    return [labelName];
  }
}

class StripPrefixCandidateNamesGenerator implements CandidateNamesGenerator {
  generateCandidateNames(labelName: string): string[] {
    const prefixSeparatorIndex = labelName.indexOf(":");
    if (prefixSeparatorIndex !== -1) {
      return [labelName, labelName.substring(prefixSeparatorIndex + 1)];
    }
    return [labelName];
  }
}

class MappingsCandidateNamesGenerator implements CandidateNamesGenerator {
  constructor(readonly mappings: Map<string, string[]>) {}
  generateCandidateNames(labelName: string): string[] {
    const labelMappings = this.mappings.get(labelName);
    if (labelMappings?.length ?? 0 > 0) {
      return [labelName, ...labelMappings!];
    }
    return [labelName];
  }
}

class LabelNameMatcher implements LabelMatcher {
  constructor(private generator: CandidateNamesGenerator) {}
  findMatches(labelToMatch: Label, labels: Label[]): Label[] {
    const candidateNames = this.generator.generateCandidateNames(
      labelToMatch.name
    );
    return labels.filter(
      (label) =>
        candidateNames.find((value) => label.name === value) !== undefined
    );
  }
}

const options = yargs
  .usage("Usage: [-t github_token --dry-run] GITHUB_REPO [GITHUB_REPOS...]")
  .option("t", {
    alias: "token",
    describe: "Github token used for authentication",
    type: "string",
    demandOption: false,
  })
  .option("dry-run", {
    describe:
      "Dry-run will output a json file per repo describing the actions that would have been taken",
    type: "boolean",
    demandOption: false,
    default: false,
  })
  .parseSync();

const octokit = new Octokit({
  userAgent: `gh-label-sync/v0.0.1`,
  auth: options.t,
});

let repoAction: SyncPlanAction = updateGHLabels;

if (options.dryRun) {
  repoAction = (plan: SyncPlan) => {
    dump(`${plan.owner}_${plan.repository}_plan.json`, plan);
    return Promise.resolve();
  };
}

processRepos(
  <string[]>options._,
  (owner, repo) => {
    return getLabelsForRepo(octokit, owner, repo);
  },
  repoAction
)
  .then(() => {
    console.log("All good! Done!");
  })
  .catch((error) => {
    console.error(error);
    process.exit(-1);
  });

function processRepos(
  repos: string[],
  retriever: LabelRetriever,
  action: SyncPlanAction
): Promise<void[]> {
  const repoPromises: Promise<void>[] = [];
  repos.forEach((repo) => {
    const splitPoint = repo.lastIndexOf("/");
    const organization = repo.substring(0, splitPoint);
    const repository = repo.substring(splitPoint + 1);

    const repoPromise = retriever(organization, repository).then((labels) => {
      const syncPlan = createSyncPlanForRepo(
        organization,
        repository,
        config.desiredLabels,
        labels
      );
      action(syncPlan);
    });
    repoPromises.push(repoPromise);
  });
  return Promise.all(repoPromises);
}

function dump(filename: string, value: any): void {
  function replacer(_: string, value: Map<string, any> | any) {
    if (value instanceof Map) {
      return Object.fromEntries(value.entries());
    } else {
      return value;
    }
  }
  writeFileSync(filename, JSON.stringify(value, replacer));
}

function getLabelsForRepo(
  octokit: Octokit,
  organization: string,
  repository: string
): Promise<Label[]> {
  return octokit.paginate(octokit.rest.issues.listLabelsForRepo, {
    owner: organization,
    repo: repository,
    per_page: 100,
  });
}

function createSyncPlanForRepo(
  owner: string,
  repo: string,
  desiredLabels: Label[],
  existingLabels: Label[]
): SyncPlan {
  const sync = new SyncPlan(owner, repo);

  const matcher = new LabelNameMatcher(
    new MappingsCandidateNamesGenerator(
      new Map(Object.entries(config.mappings))
    )
  );
  desiredLabels.forEach((dl) => {
    const el = matcher.findMatches(dl, existingLabels);
    if (el.length > 0) {
      sync.addLabelToUpdate(el[0], dl);
    } else {
      sync.addLabelToCreate(dl);
    }
  });

  return sync;
}

function updateGHLabels(plan: SyncPlan) {
  const updates: Promise<any>[] = [];

  plan.labelsToUpdate.forEach((value: Label, key: string) => {
    const { name, description, ...restOfUpdate } = value;
    const promise = octokit.rest.issues.updateLabel({
      owner: plan.owner,
      repo: plan.repository,
      name: key,
      description: description ?? undefined,
      new_name: name,
      ...restOfUpdate,
    });
    updates.push(promise);
  });
  return Promise.all(updates).then(() => {
    const creations: Promise<any>[] = [];
    plan.labelsToCreate.forEach((label) => {
      const { description, ...restOfLabel } = label;
      const promise = octokit.rest.issues.createLabel({
        owner: plan.owner,
        repo: plan.repository,
        description: description ?? undefined,
        ...restOfLabel,
      });
      updates.push(promise);
    });

    return Promise.all(creations);
  });
};