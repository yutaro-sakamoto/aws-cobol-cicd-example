import { App, Aspects } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks } from 'cdk-nag';
import { EcrStack, InfrastructureStack } from '../src/main';

const app = new App();
const stack = new EcrStack(app, 'ApplicationStack', {
  env: {
    account: 'example-account',
    region: 'example-region',
  },
  synthOnly: true,
});
const infrastructureStack = new InfrastructureStack(app, 'infrastructureStack', {
  env: {
    account: 'example-account',
    region: 'example-region',
  },
  synthOnly: true,
});

Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

test('Snapshot', () => {

  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot('applicationStack');
  const infrastructureTemplate = Template.fromStack(infrastructureStack);
  expect(infrastructureTemplate.toJSON()).toMatchSnapshot('infrastructureStack');
});