import { ContractNames, DeploymentStatus, DeploymentType } from '../src';

const proxyDeploymentEventBase = {
  type: DeploymentType.PROXY,
  contractName: ContractNames.LSP3_ACCOUNT,
  status: DeploymentStatus.PENDING,
  transaction: {
    wait: async () => {
      return 'fake receipt';
    },
  },
};
export const defaultDeploymentEvents = {
  [DeploymentType.PROXY]: {
    [ContractNames.LSP3_ACCOUNT]: {
      deployment: {
        ...proxyDeploymentEventBase,
      },
      initialize: {
        ...proxyDeploymentEventBase,
        functionName: 'initialize',
      },
      error: {
        ...proxyDeploymentEventBase,
        transaction: {
          wait: () => {
            throw Error('failed');
          },
        },
      },
    },
  },
};
