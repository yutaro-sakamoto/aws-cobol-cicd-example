import { App, Aspects } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { AwsSolutionsChecks } from "cdk-nag";
import { ApplicationStack } from "../src/application-stack";
import { DeployEcsPipelineStack } from "../src/deploy-ecs-pipeline-stack";
import { InfrastructureStack } from "../src/infrastructure-stack";

const app = new App();
const applicationStack = new ApplicationStack(app, "ApplicationStack", {
  env: {
    account: "example-account",
    region: "example-region",
  },
  synthOnly: true,
});
const infrastructureStack = new InfrastructureStack(
  app,
  "infrastructureStack",
  {
    env: {
      account: "example-account",
      region: "example-region",
    },
    synthOnly: true,
  },
);
const deployEcsPipelineStack = new DeployEcsPipelineStack(
  app,
  "DeployEcsPipelineStack",
  {
    env: {
      account: "example-account",
      region: "example-region",
    },
    ecrRepositoryName: "example-repo",
    fargateService: infrastructureStack.fargateService,
  },
);

Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

test("Snapshot", () => {
  const applicationStackTemplate = Template.fromStack(applicationStack);
  expect(applicationStackTemplate.toJSON()).toMatchSnapshot("applicationStack");
  const infrastructureTemplate = Template.fromStack(infrastructureStack);
  expect(infrastructureTemplate.toJSON()).toMatchSnapshot(
    "infrastructureStack",
  );
  const deployEcsPipelineStackTemplate = Template.fromStack(
    deployEcsPipelineStack,
  );
  expect(deployEcsPipelineStackTemplate.toJSON()).toMatchSnapshot(
    "deployEcsPipelineStack",
  );
});

test("All ECR Repositories Scan On", () => {
  const template = Template.fromStack(applicationStack);
  const resources = template.findResources("AWS::ECR::Repository");
  for (const resource of Object.values(resources)) {
    expect(resource.Properties.ImageScanningConfiguration.ScanOnPush).toBe(
      true,
    );
  }
});
