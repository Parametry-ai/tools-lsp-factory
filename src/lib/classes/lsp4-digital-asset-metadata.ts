import { defaultUploadOptions } from '../helpers/config.helper';
import { ipfsUpload, prepareMetadataAsset, prepareMetadataImage } from '../helpers/uploader.helper';
import { LSPFactoryOptions } from '../interfaces';
import {
  LSP4MetadataBeforeUpload,
  LSP4MetadataForEncoding,
} from '../interfaces/lsp4-digital-asset';
import { UploadOptions } from '../interfaces/profile-upload-options';

export class LSP4DigitalAssetMetadata {
  options: LSPFactoryOptions;

  constructor(options: LSPFactoryOptions) {
    this.options = options;
  }

  static async uploadMetadata(
    metaData: LSP4MetadataBeforeUpload,
    uploadOptions?: UploadOptions
  ): Promise<LSP4MetadataForEncoding> {
    uploadOptions = uploadOptions || defaultUploadOptions;

    const [images, assets, icon] = await Promise.all([
      metaData.images
        ? Promise.all(metaData.images.map((image) => prepareMetadataImage(uploadOptions, image)))
        : null,
      metaData.assets
        ? Promise.all(metaData.assets?.map((asset) => prepareMetadataAsset(asset, uploadOptions)))
        : null,
      prepareMetadataImage(uploadOptions, metaData.icon, [256, 32]),
    ]);

    const lsp4Metadata = {
      LSP4Metadata: {
        ...metaData,
        links: metaData.links ?? null,
        images,
        assets,
        icon,
      },
    };

    let uploadResponse;
    if (uploadOptions.url) {
      // TODO: implement simple HTTP upload
    } else {
      uploadResponse = await ipfsUpload(
        JSON.stringify(lsp4Metadata),
        uploadOptions.ipfsClientOptions
      );
    }

    return {
      lsp4Metadata: lsp4Metadata,
      url: uploadResponse.cid ? 'ipfs://' + uploadResponse.cid : 'https upload TBD',
    };
  }

  async uploadMetadata(metaData: LSP4MetadataBeforeUpload, uploadOptions?: UploadOptions) {
    uploadOptions = uploadOptions || this.options.uploadOptions || defaultUploadOptions;
    return LSP4DigitalAssetMetadata.uploadMetadata(metaData, uploadOptions);
  }
}
