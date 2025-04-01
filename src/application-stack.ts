import { Stack, CfnOutput, StackProps } from "aws-cdk-lib";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";

import * as constants from "./constants";

/**
 * Stack props
 */
export interface ApplicationStackProps extends StackProps {
  /**
   * if true, only synthesize the stack
   */
  synthOnly: boolean;
}

/**
 * サンプルのスタック
 */
export class ApplicationStack extends Stack {
  public readonly ecrRepository: ecr.Repository;
  /**
   * A constructor
   * @param scope scope
   * @param id id
   * @param props properties of this stack
   */
  constructor(scope: Construct, id: string, props: ApplicationStackProps) {
    super(scope, id, props);

    this.ecrRepository = new ecr.Repository(this, "ECRRepository", {
      repositoryName: constants.ecrRepositoryName,
      imageScanOnPush: true,
    });

    const pipeline = new codepipeline.Pipeline(this, "ApplicationPipeline", {
      pipelineName: "ApplicationPipeline",
      pipelineType: codepipeline.PipelineType.V2,
    });

    new CfnOutput(this, "applicationPipelineName", {
      value: pipeline.pipelineName,
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
            process.env.AWS_CODECONNECTIONS_ARN || "aws_codeconections_arn",
          triggerOnPush: false,
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
            cache: codebuild.Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER),
            environment: {
              buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5,
              privileged: true,
              environmentVariables: {
                AWS_ACCOUNT_ID: {
                  value: props.env!.account!,
                },
                AWS_DEFAULT_REGION: {
                  value: props.env!.region!,
                },
                IMAGE_REPO_NAME: {
                  value: constants.ecrRepositoryName,
                },
                IMAGE_TAG: {
                  value: "latest",
                },
              },
            },
            buildSpec: codebuild.BuildSpec.fromObject({
              version: "0.2",
              phases: {
                pre_build: {
                  commands: [
                    "aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com",
                  ],
                },
                build: {
                  commands: [
                    "docker build -t $IMAGE_REPO_NAME:$IMAGE_TAG app",
                    "docker tag $IMAGE_REPO_NAME:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG",
                  ],
                },
                post_build: {
                  commands: [
                    "docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG",
                  ],
                },
              },
            }),
            role: new iam.Role(this, "CodeBuildRole", {
              assumedBy: new iam.ServicePrincipal("codebuild.amazonaws.com"),
              managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName(
                  "AmazonS3ReadOnlyAccess",
                ),
                iam.ManagedPolicy.fromAwsManagedPolicyName(
                  "AmazonEC2ContainerRegistryPowerUser",
                ),
                iam.ManagedPolicy.fromAwsManagedPolicyName(
                  "CloudWatchLogsFullAccess",
                ),
              ],
            }),
          }),
          input: sourceOutput,
          outputs: [buildOutput],
        }),
      ],
    });
  }
}
