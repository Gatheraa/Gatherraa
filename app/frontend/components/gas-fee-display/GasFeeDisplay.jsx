import React, { useEffect, useState } from "react";
import { calculateGasFeeETH, convertETHToFiat } from "./utils";

const GasFeeDisplay = ({ gasLimit, gasPriceGwei, ethPriceUSD }) => {
  const [gasETH, setGasETH] = useState(0);
  const [gasFiat, setGasFiat] = useState(0);

  useEffect(() => {
    if (!gasLimit || !gasPriceGwei || !ethPriceUSD) return;

    const eth = calculateGasFeeETH(gasLimit, gasPriceGwei);
    const fiat = convertETHToFiat(eth, ethPriceUSD);

    setGasETH(eth);
    setGasFiat(fiat);
  }, [gasLimit, gasPriceGwei, ethPriceUSD]);

  return (
    <div className="bg-gray-900 p-4 rounded-xl shadow-md w-full max-w-sm text-gray-200">
      <h3 className="text-sm text-gray-400 mb-2">Estimated Gas Fee</h3>
      <div className="flex justify-between items-center text-lg font-medium">
        <span>{gasETH.toFixed(6)} ETH</span>
        <span className="text-green-400">${gasFiat.toFixed(2)}</span>
      </div>
    </div>
  );
};

export default GasFeeDisplay;