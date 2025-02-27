import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { MyStack } from '../src/main';
import { AwsSolutionsChecks } from "cdk-nag";
import { Aspects } from "aws-cdk-lib";

const app = new App();
const stack = new MyStack(app, 'test');

Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

test('Snapshot', () => {

  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot();
});