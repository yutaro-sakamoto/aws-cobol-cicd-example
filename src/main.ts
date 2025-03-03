import { App, Stack, StackProps } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as ecr from "aws-cdk-lib/aws-ecr";
import { AwsSolutionsChecks, NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import * as dotenv from "dotenv";
import * as codebuild from "aws-cdk-lib/aws-codebuild";

dotenv.config();

/**
 * サンプルのスタック
 */
export class EcrStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    new ecr.Repository(this, "ECRRepository", {
      repositoryName: "my-ecr-repo",
    });

    const pipeline = new codepipeline.Pipeline(this, "ApplicationPipeline", {
      pipelineName: "ApplicationPipeline",
    });

    NagSuppressions.addResourceSuppressions(
      pipeline.artifactBucket.encryptionKey!,
      [
        {
          id: "AwsSolutions-KMS5",
          reason: "This key is used for the artifact bucket.",
        },
      ],
    );

    const sourceOutput = new codepipeline.Artifact();

    pipeline.addStage({
      stageName: "Source",
      actions: [
        new codepipeline_actions.CodeStarConnectionsSourceAction({
          actionName: "GitHubSource",
          owner: "yutaro-sakamoto",
          repo: "aws-cobol-cicd-example",
          branch: "dev",
          output: sourceOutput,
          connectionArn:
            "arn:aws:codeconnections:ap-northeast-1:377426933046:connection/7d76c990-5676-472f-9132-70f681587d55",
          triggerOnPush: true,
        }),
      ],
    });

    const buildOutput = new codepipeline.Artifact();
    pipeline.addStage({
      stageName: "Build",
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: "DockerBuild",
          project: new codebuild.PipelineProject(this, "DockerBuildProject", {
            environment: {
              buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5,
              privileged: true,
            },
            buildSpec: codebuild.BuildSpec.fromObject({
              version: "0.2",
              phases: {
                build: {
                  commands: ["echo hello > message.txt"],
                },
              },
              artifacts: {
                files: ["message.txt"],
              },
            }),
          }),
          input: sourceOutput,
          outputs: [buildOutput],
        }),
      ],
    });
  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

const stack = new EcrStack(app, "aws-cobol-cicd-example-dev", { env: devEnv });
cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
NagSuppressions.addStackSuppressions(stack, [
  { id: "AwsSolutions-IAM5", reason: "Allow IAM policies to contain *" },
  {
    id: "AwsSolutions-S1",
    reason: "Server access logs of S3 bucket are unnecessary",
  },
]);
app.synth();
