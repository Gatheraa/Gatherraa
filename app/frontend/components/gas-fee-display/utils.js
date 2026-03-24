export const calculateGasFeeETH = (gasLimit, gasPriceGwei) => {
  // ETH = gasLimit * gasPrice in Gwei / 1e9
  return (gasLimit * gasPriceGwei) / 1e9;
};

export const convertETHToFiat = (ethAmount, ethPriceUSD) => {
  return ethAmount * ethPriceUSD;
};