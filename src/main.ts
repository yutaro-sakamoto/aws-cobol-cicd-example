import { App, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dotenv from "dotenv";
import { AwsSolutionsChecks } from "cdk-nag";
import * as cdk from "aws-cdk-lib";

dotenv.config();

/**
 * サンプルのスタック
 */
export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    // define resources here...
  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new MyStack(app, "aws-cobol-cicd-example-dev", { env: devEnv });
cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

app.synth();
