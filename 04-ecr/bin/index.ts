#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { EcrCodeCommitStack } from '../lib/ecr-stack';
import { DEFAULT_STAGE } from '../../config';

const app = new cdk.App();
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
};
const stage = app.node.tryGetContext('stage') || DEFAULT_STAGE;
const repositoryName = 'eks-cdk';

new EcrCodeCommitStack(app, `ecr-${repositoryName}`, {
    env,
    repositoryName,
    stage,
    description: `ECR: ${repositoryName}`,
    terminationProtection: stage!==DEFAULT_STAGE
});
