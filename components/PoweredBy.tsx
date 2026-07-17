export function PoweredBy() {
  return (
    <div className="powered-by">
      <span className="powered-by__label">Powered by</span>
      <div className="powered-by__logos">
        <a href="https://opensea.io" target="_blank" rel="noreferrer" aria-label="OpenSea">
          <img src="/assets/powered-by/os.svg" alt="OpenSea" />
        </a>
        <a href="https://evm.now" target="_blank" rel="noreferrer" aria-label="EVM.now">
          <img src="/assets/powered-by/evm.svg" alt="EVM.now" />
        </a>
        <a href="https://ethereum.org" target="_blank" rel="noreferrer" aria-label="Ethereum">
          <img src="/assets/powered-by/eth.svg" alt="Ethereum" />
        </a>
      </div>
    </div>
  );
}
