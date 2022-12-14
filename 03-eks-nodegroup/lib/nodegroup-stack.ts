import { Stack, CfnOutput, Lazy } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

import { StackCommonProps, SSM_PREFIX, CLUSTER_NAME, INSTANCE_TYPE, GPU_INSTANCE_TYPE } from '../../config';

/**
 * AmazonSSMManagedInstanceCore role is added to connect to EC2 instance by using SSM on AWS web console
 */
export class EksNodegroupStack extends Stack {
    constructor(scope: Construct, id: string, props: StackCommonProps) {
        super(scope, id, props);

        const vpcId = this.node.tryGetContext('vpcId') || ssm.StringParameter.valueFromLookup(this, `${SSM_PREFIX}/vpc-id`);
        const vpc = ec2.Vpc.fromLookup(this, 'vpc', { vpcId: vpcId });
        
        const clusterName = `${CLUSTER_NAME}-${props.stage}`;
        const openidProviderArn = ssm.StringParameter.valueFromLookup(this, `/${clusterName}/openid-connect-provider-arn`);
        const kubectlRoleArn = ssm.StringParameter.valueFromLookup(this, `/${clusterName}/kubectl-role-arn`)
        const openIdConnectProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(this, 'importedProviderArn',
            Lazy.string({ produce: () => openidProviderArn }));
        
        const cluster = eks.Cluster.fromClusterAttributes(this, clusterName, {
            vpc,
            clusterName,
            openIdConnectProvider,
            kubectlRoleArn: Lazy.string({ produce: () => kubectlRoleArn })
        });
        const nodegroup = new eks.Nodegroup(this, 'nodegroup', {
            cluster,
            nodegroupName: 'cpu-ng',
            instanceTypes: [new ec2.InstanceType(INSTANCE_TYPE)],
            minSize: 2,
            maxSize: 10,
            capacityType: eks.CapacityType.SPOT
        });
        nodegroup.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));

        const createGpuCluster = false; 
        if (createGpuCluster) {
            const gpuNodegroup = new eks.Nodegroup(this, 'gpu-nodegroup', {
                cluster,
                nodegroupName: 'gpu-ng',
                instanceTypes: [new ec2.InstanceType(GPU_INSTANCE_TYPE)],
                labels: { 'accelerator': 'nvidia-gpu' },
                minSize: 1,
                maxSize: 10,
                // capacityType: eks.CapacityType.SPOT
            });
            gpuNodegroup.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));
        }

        new CfnOutput(this, 'WebConsoleUrl', { value: `https://${this.region}.console.aws.amazon.com/eks/home?#/clusters/${cluster.clusterName}?selectedTab=cluster-compute-tab` });
        new CfnOutput(this, 'NodegroupName', { value: nodegroup.nodegroupName });
        new CfnOutput(this, 'RoleArn', { value: nodegroup.role.roleArn });
    }
}
