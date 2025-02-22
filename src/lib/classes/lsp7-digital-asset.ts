import { NonceManager } from '@ethersproject/experimental';
import { concat, concatAll, EMPTY, Observable, shareReplay, switchMap } from 'rxjs';

import versions from '../../versions.json';
import { DEFAULT_CONTRACT_VERSION } from '../helpers/config.helper';
import { waitForContractDeployment$ } from '../helpers/deployment.helper';
import {
  DeploymentEventContract,
  DeploymentEventTransaction,
  LSPFactoryOptions,
} from '../interfaces';
import {
  ContractDeploymentOptionsNonReactive,
  ContractDeploymentOptionsReactive,
  ContractNames,
  DeployedLSP7DigitalAsset,
  LSP7DigitalAssetDeploymentOptions,
} from '../interfaces/digital-asset-deployment';
import {
  lsp7BaseContractDeployment$,
  shouldDeployBaseContract$,
  waitForBaseContractAddress$,
} from '../services/base-contract.service';
import {
  lsp4MetadataUpload$,
  lsp7DigitalAssetDeployment$,
  setMetadataAndTransferOwnership$,
} from '../services/digital-asset.service';
import { isSignerUniversalProfile$ } from '../services/lsp3-account.service';

type LSP7ObservableOrPromise<
  T extends ContractDeploymentOptionsReactive | ContractDeploymentOptionsNonReactive
> = T extends ContractDeploymentOptionsReactive
  ? Observable<DeploymentEventContract | DeploymentEventTransaction>
  : Promise<DeployedLSP7DigitalAsset>;

/**
 * Class responsible for deploying LSP7 Digital Assets
 *
 * @property {LSPFactoryOptions} options
 * @property {NonceManager} signer
 * @memberof LSPFactory
 */
export class LSP7DigitalAsset {
  options: LSPFactoryOptions;
  signer: NonceManager;
  constructor(options: LSPFactoryOptions) {
    this.options = options;
    this.signer = new NonceManager(options.signer);
  }

  /**
   * Deploys a mintable LSP7 Digital Asset
   *
   * Returns a Promise with deployed contract details or an RxJS Observable of transaction details if `deployReactive` flag is set to true
   *
   * @param {LSP7DigitalAssetDeploymentOptions} digitalAssetDeploymentOptions
   * @param {ContractDeploymentOptions} contractDeploymentOptions
   * @return {*}  Promise<DeployedContracts> | Observable<DigitalAssetDeploymentEvent>
   * @memberof LSP7DigitalAsset
   *
   * @example
   * ```javascript
   *lspFactory.LSP7DigitalAsset.deploy({
   *  name: "My token",
   *  symbol: "TKN",
   *  ownerAddress: "0xb74a88C43BCf691bd7A851f6603cb1868f6fc147",
   *  isNFT: true,
   *})
   *```
   */
  deploy<
    T extends
      | ContractDeploymentOptionsReactive
      | ContractDeploymentOptionsNonReactive = ContractDeploymentOptionsNonReactive
  >(
    digitalAssetDeploymentOptions: LSP7DigitalAssetDeploymentOptions,
    contractDeploymentOptions: T = undefined
  ): LSP7ObservableOrPromise<T> {
    const lsp4Metadata$ = lsp4MetadataUpload$(
      digitalAssetDeploymentOptions.digitalAssetMetadata,
      contractDeploymentOptions?.uploadOptions ?? this.options.uploadOptions
    );

    const defaultBaseContractAddress: string | undefined =
      contractDeploymentOptions?.libAddress ??
      versions[this.options.chainId]?.contracts.LSP7Mintable?.versions[
        contractDeploymentOptions?.version ?? DEFAULT_CONTRACT_VERSION
      ];

    const deployBaseContract$ = shouldDeployBaseContract$(
      this.options.provider,
      versions[this.options.chainId]?.contracts.LSP7Mintable?.baseContract,
      contractDeploymentOptions?.deployProxy,
      defaultBaseContractAddress,
      contractDeploymentOptions?.libAddress,
      contractDeploymentOptions?.byteCode
    );

    const baseContractDeployment$ = deployBaseContract$.pipe(
      switchMap((shouldDeployBaseContract) => {
        return shouldDeployBaseContract ? lsp7BaseContractDeployment$(this.options.signer) : EMPTY;
      }),
      shareReplay()
    );

    const baseContractAddress$ = waitForBaseContractAddress$(
      baseContractDeployment$,
      defaultBaseContractAddress,
      contractDeploymentOptions?.deployProxy,
      contractDeploymentOptions?.byteCode
    );

    const digitalAsset$ = lsp7DigitalAssetDeployment$(
      this.signer,
      digitalAssetDeploymentOptions,
      baseContractAddress$,
      contractDeploymentOptions?.byteCode
    );

    const signerIsUniversalProfile$ = isSignerUniversalProfile$(this.signer);

    const setLSP4AndTransferOwnership$ = setMetadataAndTransferOwnership$(
      this.signer,
      digitalAsset$,
      lsp4Metadata$,
      digitalAssetDeploymentOptions,
      ContractNames.LSP7_DIGITAL_ASSET,
      signerIsUniversalProfile$
    );

    const deployment$ = concat([
      baseContractDeployment$,
      digitalAsset$,
      setLSP4AndTransferOwnership$,
    ]).pipe(concatAll());

    if (contractDeploymentOptions?.deployReactive) return deployment$ as LSP7ObservableOrPromise<T>;

    return waitForContractDeployment$(deployment$) as LSP7ObservableOrPromise<T>;
  }
}
