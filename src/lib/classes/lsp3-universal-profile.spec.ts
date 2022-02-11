import crypto from 'crypto';

import { ERC725 } from '@erc725/erc725.js';
import KeyManagerContract from '@lukso/universalprofile-smart-contracts/artifacts/LSP6KeyManager.json';
import UniversalProfileContract from '@lukso/universalprofile-smart-contracts/artifacts/UniversalProfile.json';
import { providers } from 'ethers';
import { ethers } from 'hardhat';
import { Observable } from 'rxjs';

import { UniversalProfile__factory } from '../../../build/main/src';
import { LSPFactory } from '../../../build/main/src/lib/lsp-factory';
import { testUPDeploymentWithBaseContractFlag } from '../../../test/test.utils';
import {
  ADDRESS_PERMISSIONS_ARRAY_KEY,
  DEFAULT_PERMISSIONS,
  PREFIX_PERMISSIONS,
} from '../helpers/config.helper';

import { lsp3ProfileJson } from './../../../test/lsp3-profile.mock';
import { DeployedContracts, DeploymentEvent } from './../interfaces';
import { ProxyDeployer } from './proxy-deployer';

jest.setTimeout(60000);
jest.useRealTimers();
describe('LSP3UniversalProfile', () => {
  let signers: any[];
  let provider: providers.JsonRpcProvider;
  let lspFactory: LSPFactory;

  beforeAll(async () => {
    signers = await ethers.getSigners();
    provider = ethers.provider;

    lspFactory = new LSPFactory(provider, signers[0]);
  });

  describe('Deploying with LSP3Profile Metadata', () => {
    let signer;
    let universalProfile;
    let keyManager;

    beforeAll(async () => {
      signer = signers[0];

      const { ERC725Account, KeyManager } = (await lspFactory.LSP3UniversalProfile.deploy({
        controllerAddresses: ['0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'],
        lsp3Profile: lsp3ProfileJson,
      })) as DeployedContracts;

      universalProfile = UniversalProfile__factory.connect(ERC725Account.address, signer);
      keyManager = KeyManager;
    });

    it('should deploy and set LSP3Profile data', async () => {
      const ownerAddress = await universalProfile.owner();
      expect(ownerAddress).toEqual(keyManager.address);

      const data = await universalProfile.getData([
        '0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5',
      ]);

      expect(data[0].startsWith('0x6f357c6a')).toBe(true);
    });
  });

  describe('Deploying a UP with one controller address', () => {
    let uniqueController;
    let universalProfile;

    beforeAll(async () => {
      uniqueController = signers[0];

      const { ERC725Account } = (await lspFactory.LSP3UniversalProfile.deploy({
        controllerAddresses: [uniqueController.address],
      })) as DeployedContracts;

      universalProfile = UniversalProfile__factory.connect(ERC725Account.address, uniqueController);
    });

    it('controller address should have DEFAULT_PERMISSIONS set', async () => {
      const [signerPermissions] = await universalProfile.getData([
        PREFIX_PERMISSIONS + uniqueController.address.substring(2),
      ]);

      expect(signerPermissions).toEqual(ERC725.encodePermissions(DEFAULT_PERMISSIONS));
    });

    it('controller address should be registered in AddressPermissions[0] array', async () => {
      const hexIndex = ethers.utils.hexlify([0]);
      const key =
        ADDRESS_PERMISSIONS_ARRAY_KEY.slice(0, 34) +
        ethers.utils.hexZeroPad(hexIndex, 16).substring(2);

      const [result] = await universalProfile.getData([key]);
      const checkedsumResult = ethers.utils.getAddress(result);
      expect(checkedsumResult).toEqual(uniqueController.address);
    });
  });

  describe('Deploying UP with 2 x controller addresses', () => {
    let universalProfile;
    let keyManager;
    let firstControllerAddress;
    let secondControllerAddress;

    beforeAll(async () => {
      firstControllerAddress = signers[0].address;
      secondControllerAddress = signers[1].address;

      const { ERC725Account, KeyManager } = (await lspFactory.LSP3UniversalProfile.deploy({
        controllerAddresses: [firstControllerAddress, secondControllerAddress],
      })) as DeployedContracts;

      universalProfile = new ethers.Contract(
        ERC725Account.address,
        UniversalProfileContract.abi,
        provider
      );

      keyManager = new ethers.Contract(KeyManager.address, KeyManagerContract.abi, provider);
    });

    it('1st address should have DEFAULT_PERMISSIONS set', async () => {
      const [signerPermissions] = await universalProfile
        .connect(signers[0])
        .callStatic.getData([PREFIX_PERMISSIONS + firstControllerAddress.substring(2)]);

      expect(signerPermissions).toEqual(ERC725.encodePermissions(DEFAULT_PERMISSIONS));
    });

    it('1st address should be registered in AddressPermissions[0] array', async () => {
      const hexIndex = ethers.utils.hexlify([0]);
      const key =
        ADDRESS_PERMISSIONS_ARRAY_KEY.slice(0, 34) +
        ethers.utils.hexZeroPad(hexIndex, 16).substring(2);

      const [result] = await universalProfile.connect(signers[0]).callStatic.getData([key]);
      const checkedsumResult = ethers.utils.getAddress(result);
      expect(checkedsumResult).toEqual(firstControllerAddress);
    });

    it('2nd address should have DEFAULT_PERMISSIONS set', async () => {
      const [signerPermissions] = await universalProfile
        .connect(signers[1])
        .callStatic.getData([PREFIX_PERMISSIONS + secondControllerAddress.substring(2)]);

      expect(signerPermissions).toEqual(ERC725.encodePermissions(DEFAULT_PERMISSIONS));
    });

    it('2nd address should be registered in AddressPermissions[1] array', async () => {
      const hexIndex = ethers.utils.hexlify([1]);
      const key =
        ADDRESS_PERMISSIONS_ARRAY_KEY.slice(0, 34) +
        ethers.utils.hexZeroPad(hexIndex, 16).substring(2);

      const [result] = await universalProfile.connect(signers[0]).callStatic.getData([key]);
      const checkedsumResult = ethers.utils.getAddress(result);
      expect(checkedsumResult).toEqual(secondControllerAddress);
    });
    it('All controllers should be able to setData', async () => {
      const controllers = [signers[0], signers[1]];
      for (const controller of controllers) {
        const key = '0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5';
        const value = '0x' + crypto.randomBytes(32).toString('hex');

        const abi = await universalProfile.populateTransaction.setData([key], [value]);

        const result = await keyManager.connect(controller).execute(abi.data);

        expect(result).toBeTruthy();

        const data = await universalProfile.getData([key]);

        expect(data).toEqual([value]);
      }
    });
  });

  describe('Reactive deployment', () => {
    it('should have correct controller address', (done) => {
      lspFactory = new LSPFactory(provider, signers[0]);

      const deployments$ = lspFactory.LSP3UniversalProfile.deploy(
        {
          controllerAddresses: [signers[0].address],
          lsp3Profile: lsp3ProfileJson,
        },
        {
          deployReactive: true,
        }
      ) as Observable<DeploymentEvent>;

      let erc725Address: string;
      let keyManagerAddress: string;

      deployments$.subscribe({
        next: (deploymentEvent: DeploymentEvent) => {
          if (
            deploymentEvent.receipt?.contractAddress &&
            deploymentEvent.contractName === 'ERC725Account'
          ) {
            erc725Address = deploymentEvent.receipt.contractAddress;
          }

          if (
            deploymentEvent.receipt?.contractAddress &&
            deploymentEvent.contractName === 'KeyManager'
          ) {
            keyManagerAddress = deploymentEvent.receipt.contractAddress;
          }
        },
        error: (error) => {
          // Fail to exit subsciber
          expect(1).toEqual(error);
        },
        complete: async () => {
          const universalProfile = UniversalProfile__factory.connect(erc725Address, signers[0]);

          const ownerAddress = await universalProfile.owner();
          expect(ownerAddress).toEqual(keyManagerAddress);

          done();
        },
      });
    });
  });

  describe.only('baseContract deployment flag', () => {
    describe('Deployment with all baseContract flags set to false', () => {
      it('Should not deploy base contracts', async () => {
        const deployedContracts: DeployedContracts = (await lspFactory.LSP3UniversalProfile.deploy(
          {
            controllerAddresses: ['0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'],
          },
          {
            ERC725Account: { baseContract: false },
            KeyManager: { baseContract: false },
            UniversalReceiverDelegate: { baseContract: false },
          }
        )) as DeployedContracts;

        expect(Object.keys(deployedContracts).length).toEqual(3);
      });
    });

    describe('Deployment with only ERC725 baseContract set to true', () => {
      it('Should deploy only ERC725 Base contract', async () => {
        await testUPDeploymentWithBaseContractFlag(
          {
            ERC725Account: false,
            KeyManager: false,
            UniversalReceiverDelegate: false,
          },
          3,
          lspFactory
        );
      });
    });

    describe('Deployment with only KeyManager baseContract set to true', () => {
      it('Should deploy only KeyManager Base contract', async () => {
        await testUPDeploymentWithBaseContractFlag(
          {
            ERC725Account: false,
            KeyManager: true,
            UniversalReceiverDelegate: false,
          },
          4,
          lspFactory
        );
      });
    });

    describe.skip('Deployment with only URD baseContract set to true', () => {
      it('Should deploy only URD Base contract', async () => {
        await testUPDeploymentWithBaseContractFlag(
          {
            ERC725Account: false,
            KeyManager: true,
            UniversalReceiverDelegate: false,
          },
          4,
          lspFactory
        );
      });
    });
  });

  describe('Deploying UP from specified base contracts', () => {
    let universalProfile;
    let signer;
    let keyManager;
    let deployedContracts: DeployedContracts;
    let baseContracts;

    beforeAll(async () => {
      const proxyDeployer = new ProxyDeployer(signers[0]);
      baseContracts = await proxyDeployer.deployUniversalProfileBaseContracts();

      signer = signers[0];
      deployedContracts = (await lspFactory.LSP3UniversalProfile.deploy(
        {
          controllerAddresses: [signer.address],
        },
        {
          ERC725Account: { libAddress: baseContracts.universalProfile.address },
        }
      )) as DeployedContracts;

      universalProfile = UniversalProfile__factory.connect(
        deployedContracts.ERC725Account.address,
        signer
      );

      keyManager = new ethers.Contract(
        deployedContracts.KeyManager.address,
        KeyManagerContract.abi,
        provider
      );
    });

    it('should only deploy proxy contract', async () => {
      expect(Object.keys(deployedContracts).length).toEqual(3);
    });

    it('should be able to setData', async () => {
      const key = '0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5';
      const value = '0x' + crypto.randomBytes(32).toString('hex');

      const abi = await universalProfile.populateTransaction.setData([key], [value]);

      const result = await keyManager.connect(signers[0]).execute(abi.data);

      expect(result).toBeTruthy();

      const data = await universalProfile.getData([key]);

      expect(data).toEqual([value]);
    });
  });
});
