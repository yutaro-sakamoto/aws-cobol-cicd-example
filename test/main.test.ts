import { App, Aspects } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks } from 'cdk-nag';
import { EcrStack } from '../src/main';

const app = new App();
const stack = new EcrStack(app, 'test');

Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

test('Snapshot', () => {

  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot();
});