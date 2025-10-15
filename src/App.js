import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, X } from 'lucide-react';

const CFDTradingPlatform = () => {
  const [balance, setBalance] = useState(10000);
  const [currentPrice, setCurrentPrice] = useState(150);
  const [candles, setCandles] = useState([]);
  const [lotSize, setLotSize] = useState('');
  const [sentiment, setSentiment] = useState('neutral');
  const [openPositions, setOpenPositions] = useState([]);
  const [closedTrades, setClosedTrades] = useState([]);
  const [leverage] = useState(20);
  const [spread] = useState(0.005);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);
  
  const sentimentRef = useRef('neutral');
  const candleTimer = useRef(null);
  const sentimentTimer = useRef(null);
  const chartRef = useRef(null);

  const sentiments = [
    { name: 'very_bearish', bias: -0.0008, volatility: 0.0003, upChance: 0.25 },
    { name: 'bearish', bias: -0.0004, volatility: 0.0002, upChance: 0.35 },
    { name: 'neutral', bias: 0, volatility: 0.0004, upChance: 0.5 },
    { name: 'bullish', bias: 0.0004, volatility: 0.0002, upChance: 0.65 },
    { name: 'very_bullish', bias: 0.0008, volatility: 0.0003, upChance: 0.75 }
  ];

  const getSentimentConfig = () => {
    return sentiments.find(s => s.name === sentimentRef.current) || sentiments[2];
  };

  const generateCandle = (lastClose) => {
    const config = getSentimentConfig();
    const vol = config.volatility;
    
    const goesUp = Math.random() < config.upChance;
    const strength = 0.3 + Math.random() * 0.7;
    const isExtremeMove = Math.random() < 0.02;
    const extremeMultiplier = isExtremeMove ? (3 + Math.random() * 4) : 1;
    
    let change;
    if (goesUp) {
      change = (Math.abs(config.bias) * strength + Math.random() * vol) * extremeMultiplier;
    } else {
      change = -(Math.abs(config.bias) * strength + Math.random() * vol) * extremeMultiplier;
    }
    
    change += (Math.random() - 0.5) * vol * 0.5;
    
    const open = lastClose;
    const close = open * (1 + change);
    
    const spreadVal = Math.abs(close - open);
    const wickSize = spreadVal * (0.5 + Math.random() * 1.5);
    
    const high = Math.max(open, close) + wickSize * Math.random();
    const low = Math.min(open, close) - wickSize * Math.random();
    
    return { open, high, low, close, time: Date.now() };
  };

  useEffect(() => {
    const initialCandles = [];
    let price = 150;
    
    for (let i = 0; i < 200; i++) {
      const candle = generateCandle(price);
      initialCandles.push(candle);
      price = candle.close;
    }
    
    setCandles(initialCandles);
    setCurrentPrice(price);

    candleTimer.current = setInterval(() => {
      setCandles(prev => {
        const lastCandle = prev[prev.length - 1];
        const newCandle = generateCandle(lastCandle.close);
        setCurrentPrice(newCandle.close);
        return [...prev, newCandle];
      });
    }, 2000);

    const changeSentiment = () => {
      const newSentiment = sentiments[Math.floor(Math.random() * sentiments.length)].name;
      sentimentRef.current = newSentiment;
      setSentiment(newSentiment);
    };

    sentimentTimer.current = setInterval(changeSentiment, 30000);

    return () => {
      clearInterval(candleTimer.current);
      clearInterval(sentimentTimer.current);
    };
  }, []);

  const buyPrice = currentPrice * (1 + spread);
  const sellPrice = currentPrice * (1 - spread);

  const usedMargin = openPositions.reduce((sum, pos) => sum + pos.margin, 0);
  const freeMargin = balance - usedMargin;
  
  const maxBuyLots = Math.floor((freeMargin * leverage / buyPrice) * 100) / 100;
  const maxSellLots = Math.floor((freeMargin * leverage / sellPrice) * 100) / 100;
  const maxLots = Math.max(0, Math.max(maxBuyLots, maxSellLots));

  const handleSliderChange = (e) => {
    const value = parseFloat(e.target.value);
    setLotSize(value > 0 ? value.toFixed(2) : '');
  };

  const openBuy = () => {
    const lots = parseFloat(lotSize);
    if (!lots || lots <= 0) return;
    
    const margin = (lots * buyPrice) / leverage;
    if (margin > freeMargin) {
      alert('Insufficient margin');
      return;
    }

    const newPosition = {
      id: Date.now(),
      type: 'BUY',
      lots,
      openPrice: buyPrice,
      margin,
      openTime: new Date().toLocaleTimeString()
    };
    
    setOpenPositions(prev => [...prev, newPosition]);
    setLotSize('');
  };

  const openSell = () => {
    const lots = parseFloat(lotSize);
    if (!lots || lots <= 0) return;
    
    const margin = (lots * sellPrice) / leverage;
    if (margin > freeMargin) {
      alert('Insufficient margin');
      return;
    }

    const newPosition = {
      id: Date.now(),
      type: 'SELL',
      lots,
      openPrice: sellPrice,
      margin,
      openTime: new Date().toLocaleTimeString()
    };
    
    setOpenPositions(prev => [...prev, newPosition]);
    setLotSize('');
  };

  const closePosition = (position) => {
    const closePrice = position.type === 'BUY' ? sellPrice : buyPrice;
    const pnl = position.type === 'BUY' 
      ? (closePrice - position.openPrice) * position.lots
      : (position.openPrice - closePrice) * position.lots;
    
    setBalance(prev => prev + pnl);
    setOpenPositions(prev => prev.filter(p => p.id !== position.id));
    setClosedTrades(prev => [{
      ...position,
      closePrice,
      pnl,
      closeTime: new Date().toLocaleTimeString()
    }, ...prev]);
  };

  const totalUnrealizedPL = openPositions.reduce((sum, pos) => {
    if (pos.type === 'BUY') {
      return sum + (currentPrice - pos.openPrice) * pos.lots;
    } else {
      return sum + (pos.openPrice - currentPrice) * pos.lots;
    }
  }, 0);

  const equity = balance + totalUnrealizedPL;

  const getSentimentDisplay = () => {
    const displays = {
      very_bearish: { text: 'Very Bearish', color: 'text-red-600' },
      bearish: { text: 'Bearish', color: 'text-red-500' },
      neutral: { text: 'Neutral', color: 'text-gray-600' },
      bullish: { text: 'Bullish', color: 'text-green-500' },
      very_bullish: { text: 'Very Bullish', color: 'text-green-600' }
    };
    return displays[sentiment] || displays.neutral;
  };

  const sentimentDisplay = getSentimentDisplay();

  const candlesPerView = Math.floor(50 / zoomLevel);
  const maxScroll = Math.max(0, candles.length - candlesPerView);
  const actualScrollOffset = Math.min(scrollOffset, maxScroll);
  const visibleCandles = candles.slice(
    candles.length - candlesPerView - actualScrollOffset,
    candles.length - actualScrollOffset
  );

  const maxPrice = Math.max(...visibleCandles.map(c => c.high));
  const minPrice = Math.min(...visibleCandles.map(c => c.low));
  const priceRange = maxPrice - minPrice;
  const padding = priceRange * 0.1;
  const chartMax = maxPrice + padding;
  const chartMin = minPrice - padding;
  const chartRange = chartMax - chartMin;

  const priceToY = (price) => {
    return ((chartMax - price) / chartRange) * 100;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoomLevel(prev => Math.max(0.5, Math.min(5, prev * delta)));
    } else {
      const delta = e.deltaY > 0 ? 5 : -5;
      setScrollOffset(prev => Math.max(0, Math.min(maxScroll, prev + delta)));
    }
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart(e.clientX);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const delta = dragStart - e.clientX;
    const candleDelta = Math.floor(delta / 10);
    if (Math.abs(candleDelta) > 0) {
      setScrollOffset(prev => Math.max(0, Math.min(maxScroll, prev + candleDelta)));
      setDragStart(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  const yAxisPrices = [];
  const numLabels = 8;
  for (let i = 0; i <= numLabels; i++) {
    const price = chartMin + (chartRange * i / numLabels);
    yAxisPrices.push(price);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">CFD Trading Platform</h1>
            <div className="text-right">
              <div className="text-sm text-gray-500">Equity</div>
              <div className={`text-3xl font-bold ${equity >= 10000 ? 'text-green-600' : 'text-red-600'}`}>
                ${equity.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded">
              <div className="text-xs text-gray-500 uppercase mb-1">Balance</div>
              <div className="text-xl font-semibold">${balance.toFixed(2)}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <div className="text-xs text-gray-500 uppercase mb-1">Used Margin</div>
              <div className="text-xl font-semibold">${usedMargin.toFixed(2)}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <div className="text-xs text-gray-500 uppercase mb-1">Free Margin</div>
              <div className="text-xl font-semibold">${freeMargin.toFixed(2)}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <div className="text-xs text-gray-500 uppercase mb-1">Unrealized P/L</div>
              <div className={`text-xl font-semibold ${totalUnrealizedPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${totalUnrealizedPL.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="col-span-2 bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-2xl font-bold">TECH/USD</h2>
                <div className="text-3xl font-bold mt-1">${currentPrice.toFixed(2)}</div>
                <div className={`text-sm flex items-center gap-1 mt-1 ${currentPrice >= 150 ? 'text-green-600' : 'text-red-600'}`}>
                  {currentPrice >= 150 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  {((currentPrice - 150) / 150 * 100).toFixed(2)}%
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-semibold ${sentimentDisplay.color}`}>
                  {sentimentDisplay.text}
                </div>
                <div className="text-xs text-gray-500 mt-1">Leverage: 1:{leverage}</div>
              </div>
            </div>

            <div 
              ref={chartRef}
              className="h-96 bg-gray-50 rounded relative overflow-hidden cursor-move select-none"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
            >
              <div className="absolute top-2 left-2 text-xs text-gray-500 bg-white px-2 py-1 rounded z-10">
                Scroll: Mouse wheel | Zoom: Ctrl+Wheel | Drag: Click & drag
              </div>
              <div className="h-full flex">
                <div className="w-20 relative border-r border-gray-200 bg-white">
                  {yAxisPrices.reverse().map((price, i) => (
                    <div
                      key={i}
                      className="absolute right-2 text-xs text-gray-600 font-mono"
                      style={{ top: `${(i / numLabels) * 100}%`, transform: 'translateY(-50%)' }}
                    >
                      {price.toFixed(2)}
                    </div>
                  ))}
                </div>
                
                <div className="flex-1 relative">
                  <svg width="100%" height="100%" className="overflow-visible">
                    {openPositions.map((pos) => {
                      const y = priceToY(pos.openPrice);
                      const color = pos.type === 'BUY' ? '#10b981' : '#ef4444';
                      return (
                        <g key={pos.id}>
                          <line
                            x1="0"
                            y1={`${y}%`}
                            x2="100%"
                            y2={`${y}%`}
                            stroke={color}
                            strokeWidth="2"
                            strokeDasharray="5,5"
                            opacity="0.6"
                          />
                        </g>
                      );
                    })}
                    
                    {visibleCandles.map((candle, i) => {
                      const x = (i / (visibleCandles.length - 1)) * 100;
                      const candleWidth = 100 / visibleCandles.length;
                      const width = Math.max(Math.min(candleWidth * 0.6, 8), 1);
                      
                      const yHigh = priceToY(candle.high);
                      const yLow = priceToY(candle.low);
                      const yOpen = priceToY(candle.open);
                      const yClose = priceToY(candle.close);
                      
                      const isGreen = candle.close >= candle.open;
                      const color = isGreen ? '#10b981' : '#ef4444';
                      
                      const bodyTop = Math.min(yOpen, yClose);
                      const bodyHeight = Math.max(Math.abs(yClose - yOpen), 0.5);
                      
                      return (
                        <g key={i}>
                          <line
                            x1={`${x}%`}
                            y1={`${yHigh}%`}
                            x2={`${x}%`}
                            y2={`${yLow}%`}
                            stroke={color}
                            strokeWidth="1"
                          />
                          <rect
                            x={`${x - width/2}%`}
                            y={`${bodyTop}%`}
                            width={`${width}%`}
                            height={`${bodyHeight}%`}
                            fill={color}
                            stroke={color}
                            strokeWidth="1"
                          />
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-bold mb-4">New Order</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-green-50 p-2 rounded">
                  <div className="text-xs text-gray-600">Buy Price</div>
                  <div className="text-lg font-bold text-green-600">${buyPrice.toFixed(2)}</div>
                </div>
                <div className="bg-red-50 p-2 rounded">
                  <div className="text-xs text-gray-600">Sell Price</div>
                  <div className="text-lg font-bold text-red-600">${sellPrice.toFixed(2)}</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Lot Size: <span className="font-bold">{lotSize || '0.00'}</span> lots
                  {maxLots > 0 && (
                    <span className="text-xs text-gray-500 ml-2">
                      (Max: {maxLots.toFixed(2)})
                    </span>
                  )}
                </label>
                <input
                  type="range"
                  min="0"
                  max={maxLots}
                  step="0.01"
                  value={lotSize || 0}
                  onChange={handleSliderChange}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0</span>
                  <span>{maxLots.toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={openBuy}
                  className="bg-green-600 text-white py-3 rounded font-semibold hover:bg-green-700 transition"
                >
                  BUY
                </button>
                <button
                  onClick={openSell}
                  className="bg-red-600 text-white py-3 rounded font-semibold hover:bg-red-700 transition"
                >
                  SELL
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-lg font-bold mb-4">Open Positions</h3>
          {openPositions.length === 0 ? (
            <div className="text-center text-gray-400 py-8">No open positions</div>
          ) : (
            <div className="space-y-2">
              {openPositions.map((pos) => {
                const currentPL = pos.type === 'BUY' 
                  ? (currentPrice - pos.openPrice) * pos.lots
                  : (pos.openPrice - currentPrice) * pos.lots;
                const plPercent = ((currentPL / pos.margin) * 100);
                
                return (
                  <div key={pos.id} className="flex items-center justify-between bg-gray-50 p-4 rounded">
                    <div className="flex items-center gap-4">
                      <div className={`font-bold ${pos.type === 'BUY' ? 'text-green-600' : 'text-red-600'}`}>
                        {pos.type}
                      </div>
                      <div>
                        <div className="font-semibold">{pos.lots} lots</div>
                        <div className="text-sm text-gray-500">@ ${pos.openPrice.toFixed(2)}</div>
                      </div>
                      <div className="text-sm text-gray-500">
                        Margin: ${pos.margin.toFixed(2)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className={`font-bold ${currentPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${currentPL.toFixed(2)}
                        </div>
                        <div className={`text-sm ${currentPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {plPercent.toFixed(2)}%
                        </div>
                      </div>
                      <button
                        onClick={() => closePosition(pos)}
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition flex items-center gap-1"
                      >
                        <X size={16} />
                        Close
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-bold mb-4">Trade History</h3>
          {closedTrades.length === 0 ? (
            <div className="text-center text-gray-400 py-8">No closed trades</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {closedTrades.map((trade, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 p-3 rounded text-sm">
                  <div className={`font-semibold ${trade.type === 'BUY' ? 'text-green-600' : 'text-red-600'}`}>
                    {trade.type}
                  </div>
                  <div>{trade.lots} lots</div>
                  <div className="text-gray-600">
                    ${trade.openPrice.toFixed(2)} → ${trade.closePrice.toFixed(2)}
                  </div>
                  <div className={`font-semibold ${trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                  </div>
                  <div className="text-gray-500">{trade.closeTime}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CFDTradingPlatform;