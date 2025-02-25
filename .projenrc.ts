import { AwsCdkTypeScriptApp } from '@yutaro-sakamoto/projen-cdk';
import { YamlFile } from 'projen';

const project = new AwsCdkTypeScriptApp({
  cdkVersion: '2.1.0',
  defaultReleaseBranch: 'main',
  devDeps: ['@yutaro-sakamoto/projen-cdk@v0.0.13'],
  name: 'aws-cobol-cicd-example',
  projenrcTs: true,

  // deps: [],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  // packageName: undefined,  /* The "name" in package.json. */
});

project.addDeps('dotenv');
project.gitignore.addPatterns('.env');


// Deploy to AWS
new YamlFile(project, '.github/workflows/push-dev.yml', {
  obj: {
    name: 'push',
    on: {
      push: {
        branches: ['dev'],
      },
    },
    concurrency: {
      'group': '${{ github.workflow }}-${{ github.ref }}',
      'cancel-in-progress': true,
    },
    permissions: {
      contents: 'read',
    },
    jobs: {
      'check-workflows': {
        permissions: {
          contents: 'read',
        },
        uses: './.github/workflows/check-workflows.yml',
      },
      'test': {
        needs: 'check-workflows',
        permissions: {
          contents: 'read',
        },
        secrets: 'inherit',
        uses: './.github/workflows/deploy.yml',
        with: {
          environment: 'dev',
        }
      },
    },
  },
});

// Deploy to AWS
new YamlFile(project, '.github/workflows/deploy.yml', {
  obj: {
    name: 'deploy',
    on: {
      workflow_call: {
        inputs: {
          environment: {
            type: 'string',
            required: true,
            description: 'Environment to deploy to',
          }
        }
      }
    },
    permissions: {
      contents: 'read',
      'id-token': 'write',
    },
    jobs: {
      deploy: {
        'runs-on': 'ubuntu-latest',
        environment: '${{ inputs.environment }}',
        steps: [
          {
            uses: 'aws-actions/configure-aws-credentials@v4',
            with: {
              'role-to-assume': 'arn:aws:iam::${{ secrets.AWS_ID }}:role/${{ secrets.ROLE_NAME }}',
              'role-session-name': 'gh-oidc-${{ github.run_id }}-${{ github.run_attempt }}',
              'aws-region': '${{ secrets.AWS_REGION }}',
            },
          },
          {
            name: 'Checkout',
            uses: 'actions/checkout@v4',
          },
          {
            uses: 'actions/setup-node@v4',
            with: {
              'node-version': '22',
              cache: 'npm',
              'cache-dependency-path': 'package-lock.json',
            },
          },
          {
            run: 'npm ci',
          },
          {
            name: 'Set environment variabble CDK_DEFAULT_REGION',
            run: 'echo "export CDK_DEFAULT_REGION=${{ secrets.AWS_REGION }}" >> $GITHUB_ENV',
          },
          {
            name: 'Set environment variabble CDK_DEFAULT_ACCOUNT',
            run: 'echo "export CDK_DEFAULT_ACCOUNT=${{ secrets.AWS_ID }}" >> $GITHUB_ENV',
          },
          {
            name: 'Deploy',
            run: 'npx cdk deploy --require-approval never',
          },
        ],
      },
    },
  },
});


project.synth();