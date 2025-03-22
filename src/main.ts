import { App } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { AwsSolutionsChecks, NagSuppressions } from "cdk-nag";
import * as dotenv from "dotenv";
import { ApplicationStack } from "./application-stack";
import * as constants from "./constants";
import { DeployEcsPipelineStack } from "./deploy-ecs-pipeline-stack";
import { InfrastructureStack } from "./infrastructure-stack";

dotenv.config();

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const stackProps = {
  env: devEnv,
  synthOnly: process.env.CDK_SYNTH_ONLY
    ? process.env.CDK_SYNTH_ONLY === "true"
    : false,
};

const app = new App();

const stack = new ApplicationStack(
  app,
  "aws-cobol-cicd-example-dev",
  stackProps,
);
const infrastructureStack = new InfrastructureStack(
  app,
  "aws-cobol-cicd-example-dev-infrastructures",
  stackProps,
);

const deployEcsPipelineStack = new DeployEcsPipelineStack(
  app,
  "aws-cobol-cicd-example-dev-ecs-pipeline",
  {
    env: devEnv,
    ecrRepositoryName: constants.ecrRepositoryName,
    fargateService: infrastructureStack.fargateService,
  },
);

cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
NagSuppressions.addStackSuppressions(stack, [
  { id: "AwsSolutions-IAM5", reason: "Allow IAM policies to contain *" },
  { id: "AwsSolutions-IAM4", reason: "Allow using managed policies" },
  {
    id: "AwsSolutions-S1",
    reason: "Server access logs of S3 bucket are unnecessary",
  },
]);
NagSuppressions.addStackSuppressions(infrastructureStack, [
  { id: "AwsSolutions-IAM5", reason: "Allow IAM policies to contain *" },
  { id: "AwsSolutions-IAM4", reason: "Allow using managed policies" },
  {
    id: "AwsSolutions-S1",
    reason: "Server access logs of S3 bucket are unnecessary",
  },
]);
NagSuppressions.addStackSuppressions(deployEcsPipelineStack, [
  { id: "AwsSolutions-IAM5", reason: "Allow IAM policies to contain *" },
  { id: "AwsSolutions-IAM4", reason: "Allow using managed policies" },
  {
    id: "AwsSolutions-S1",
    reason: "Server access logs of S3 bucket are unnecessary",
  },
  {
    id: "AwsSolutions-KMS5",
    reason: "Ignore key policy for artifact bucket",
  },
]);
app.synth();
