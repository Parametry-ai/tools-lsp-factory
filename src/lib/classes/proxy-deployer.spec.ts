import { ethers, SignerWithAddress } from 'hardhat';

import { ProxyDeployer } from './proxy-deployer';

describe('LSP3UniversalProfile', () => {
  let baseContracts;
  let proxyDeployer;
  let signer: SignerWithAddress;

  beforeAll(async () => {
    const provider = ethers.provider;
    signer = provider.getSigner();
    proxyDeployer = new ProxyDeployer(signer);
    baseContracts = await proxyDeployer.deployBaseContracts();
  });

  it('should deploy the LSP3Account proxy and setData', async () => {
    // LSPAccount
    const lsp3AccountProxy = await proxyDeployer.deployProxyContract(baseContracts.lsp3Account);
    await lsp3AccountProxy.initialize(await signer.getAddress());

    // UniversalReceiverAddressStore
    const universalReceiverAddressStoreProxy = await proxyDeployer.deployProxyContract(
      baseContracts.universalReceiverAddressStore
    );
    await universalReceiverAddressStoreProxy.initialize(lsp3AccountProxy.address);

    await lsp3AccountProxy.setData(
      '0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5',
      '0xbeefbeef',
      {
        from: await signer.getAddress(),
      }
    );
    const data = await lsp3AccountProxy.getData(
      '0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5'
    );

    expect(data).toEqual('0xbeefbeef');
  });
});
