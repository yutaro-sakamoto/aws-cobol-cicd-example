import { App, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dotenv from "dotenv";
import { AwsSolutionsChecks } from "cdk-nag";
import * as cdk from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";

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
    // define resources here...
  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new EcrStack(app, "aws-cobol-cicd-example-dev", { env: devEnv });
cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

app.synth();
