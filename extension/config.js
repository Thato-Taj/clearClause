// Where the extension sends scans and links people to.
// Change both to your production URLs before packaging the extension for a store.
// No CORS changes are needed on the API: it already accepts every browser-extension origin.
// eslint-disable-next-line no-unused-vars
const CLEARCLAUSE_CONFIG = Object.freeze({
  apiUrl: 'http://localhost:5001',
  webUrl: 'http://localhost:3000',
  /** Matches the API's MAX_DOCUMENT_CHARS; anything longer is cut before sending. */
  maxChars: 200000,
});
