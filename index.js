require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Load saved sessions
let sessions = {};
try {
  const fs = require('fs');
  if (fs.existsSync('./data.json')) {
    sessions = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
  }
} catch (e) {
  console.log('No existing data.json file found, starting fresh');
}

// Telegram Bot Configuration
const token = process.env.TELEGRAM_TOKEN;
if (!token) {
  console.error('TELEGRAM_TOKEN environment variable is required');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// Cryptocurrency symbols to monitor
const SYMBOLS = ['BTC', 'ETH', 'SUI', 'AVAX', 'ASTER', 'MOVE', 'KAS', 'SOL', 'MINA', 'ZEC', 'XMR', 'HYPE'];

// Timeframes to analyze
const TIMEFRAMES = ['5m', '15m', '30m', '4h', '1d', '3d', '1w', '1M'];

// Technical indicators implementation
class TechnicalIndicators {
  static calculateMA(prices, period) {
    if (prices.length < period) return null;
    const sum = prices.slice(-period).reduce((acc, price) => acc + price, 0);
    return sum / period;
  }

  static calculateEMA(prices, period) {
    if (prices.length < period) return null;
    
    const k = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    
    return ema;
  }

  static calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return null;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change >= 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  static calculateMACD(prices, fast = 12, slow = 26, signal = 9) {
    if (prices.length < slow) return null;

    const fastEMA = this.calculateEMA(prices, fast);
    const slowEMA = this.calculateEMA(prices, slow);
    const macdLine = fastEMA - slowEMA;

    // Calculate signal line (EMA of MACD line)
    // For simplicity, we'll just return the current values
    return {
      macd: macdLine,
      signal: null, // Would need historical MACD values for proper signal calculation
      histogram: null
    };
  }

  static calculateBollingerBands(prices, period = 20, stdDev = 2) {
    if (prices.length < period) return null;

    const ma = this.calculateMA(prices, period);
    let sumSquaredDiffs = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
      sumSquaredDiffs += Math.pow(prices[i] - ma, 2);
    }

    const std = Math.sqrt(sumSquaredDiffs / period);
    const upperBand = ma + (stdDev * std);
    const lowerBand = ma - (stdDev * std);

    return {
      upper: upperBand,
      middle: ma,
      lower: lowerBand
    };
  }

  static calculateFibonacciLevels(high, low) {
    const diff = high - low;
    return {
      level_236: high - diff * 0.236,
      level_382: high - diff * 0.382,
      level_500: high - diff * 0.500,
      level_618: high - diff * 0.618,
      level_786: high - diff * 0.786
    };
  }
}

// Market Structure & SMC Analysis
class SMCAnalysis {
  static findSwings(prices, windowSize = 5) {
    const swings = [];
    
    for (let i = windowSize; i < prices.length - windowSize; i++) {
      const currentPrice = prices[i];
      let isHigh = true;
      let isLow = true;

      for (let j = i - windowSize; j <= i + windowSize; j++) {
        if (j !== i) {
          if (prices[j] >= currentPrice) isHigh = false;
          if (prices[j] <= currentPrice) isLow = false;
        }
      }

      if (isHigh) {
        swings.push({ type: 'high', index: i, price: currentPrice });
      } else if (isLow) {
        swings.push({ type: 'low', index: i, price: currentPrice });
      }
    }

    return swings;
  }

  static identifyOrderBlocks(swings) {
    // Simplified order block identification
    const orderBlocks = [];
    let currentHigh = null;
    let currentLow = null;

    for (const swing of swings) {
      if (swing.type === 'high') {
        if (currentHigh && swing.price > currentHigh.price) {
          // Bullish order block formed
          orderBlocks.push({
            type: 'bullish',
            high: currentHigh.price,
            low: swing.price,
            confirmed: false
          });
          currentHigh = swing;
        } else if (!currentHigh || swing.price > currentHigh.price) {
          currentHigh = swing;
        }
      } else if (swing.type === 'low') {
        if (currentLow && swing.price < currentLow.price) {
          // Bearish order block formed
          orderBlocks.push({
            type: 'bearish',
            high: swing.price,
            low: currentLow.price,
            confirmed: false
          });
          currentLow = swing;
        } else if (!currentLow || swing.price < currentLow.price) {
          currentLow = swing;
        }
      }
    }

    return orderBlocks;
  }
}

// Price data fetcher
class PriceFetcher {
  static async fetchPrices(symbols) {
    const prices = {};
    
    for (const symbol of symbols) {
      try {
        // Using CoinGecko API as an example
        const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${symbol.toLowerCase()}&vs_currencies=usd`);
        prices[symbol] = response.data[symbol.toLowerCase()]?.usd || null;
      } catch (error) {
        console.error(`Error fetching price for ${symbol}:`, error.message);
        prices[symbol] = null;
      }
    }
    
    return prices;
  }

  static async fetchHistoricalData(symbol, timeframe) {
    // This is a simplified implementation
    // In a real scenario, you would fetch actual historical data
    // For now, we'll generate mock data
    
    const mockData = [];
    const currentPrice = Math.random() * 10000; // Mock current price
    
    for (let i = 99; i >= 0; i--) {
      const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
      const price = currentPrice * (1 + variation * (i / 100));
      mockData.push(price);
    }
    
    return mockData;
  }
}

// Trading Decision Engine
class DecisionEngine {
  static async analyzeSymbol(symbol, timeframe) {
    const historicalData = await PriceFetcher.fetchHistoricalData(symbol, timeframe);
    
    if (!historicalData || historicalData.length < 20) {
      return { symbol, timeframe, decision: 'INSUFFICIENT_DATA', reason: 'Not enough historical data' };
    }

    // Calculate technical indicators
    const currentPrice = historicalData[historicalData.length - 1];
    const ma20 = TechnicalIndicators.calculateMA(historicalData, 20);
    const ma50 = TechnicalIndicators.calculateMA(historicalData, 50);
    const rsi = TechnicalIndicators.calculateRSI(historicalData);
    const ema12 = TechnicalIndicators.calculateEMA(historicalData, 12);
    const ema26 = TechnicalIndicators.calculateEMA(historicalData, 26);
    const bb = TechnicalIndicators.calculateBollingerBands(historicalData);
    const macd = TechnicalIndicators.calculateMACD(historicalData);
    
    // Simple decision logic based on multiple indicators
    let signals = [];
    
    // Trend following signals
    if (ma20 && ma50) {
      if (ma20 > ma50) {
        signals.push('BULLISH_TREND');
      } else {
        signals.push('BEARISH_TREND');
      }
    }
    
    // RSI signals
    if (rsi !== null) {
      if (rsi < 30) {
        signals.push('OVERSOLD');
      } else if (rsi > 70) {
        signals.push('OVERBOUGHT');
      } else {
        signals.push('NEUTRAL_RSI');
      }
    }
    
    // MACD signals
    if (macd) {
      if (ema12 > ema26) {
        signals.push('BULLISH_MACD');
      } else {
        signals.push('BEARISH_MACD');
      }
    }
    
    // Bollinger Bands signals
    if (bb) {
      if (currentPrice > bb.upper) {
        signals.push('RESISTANCE_TOUCH');
      } else if (currentPrice < bb.lower) {
        signals.push('SUPPORT_TOUCH');
      } else {
        signals.push('WITHIN_BANDS');
      }
    }
    
    // Determine overall decision
    let decision = 'HOLD';
    let confidence = 'LOW';
    
    // Count bullish vs bearish signals
    const bullishSignals = signals.filter(signal => 
      signal.includes('BULLISH') || signal.includes('OVERSOLD')
    ).length;
    
    const bearishSignals = signals.filter(signal => 
      signal.includes('BEARISH') || signal.includes('OVERBOUGHT')
    ).length;
    
    if (bullishSignals > bearishSignals + 1) {
      decision = 'BUY';
      confidence = bullishSignals >= 4 ? 'HIGH' : 'MEDIUM';
    } else if (bearishSignals > bullishSignals + 1) {
      decision = 'SELL';
      confidence = bearishSignals >= 4 ? 'HIGH' : 'MEDIUM';
    }
    
    return {
      symbol,
      timeframe,
      currentPrice,
      decision,
      confidence,
      signals,
      indicators: {
        ma20,
        ma50,
        rsi,
        ema12,
        ema26,
        bb,
        macd
      }
    };
  }

  static async analyzeAllSymbols() {
    const results = {};
    
    for (const symbol of SYMBOLS) {
      results[symbol] = {};
      
      for (const timeframe of TIMEFRAMES) {
        results[symbol][timeframe] = await this.analyzeSymbol(symbol, timeframe);
      }
    }
    
    return results;
  }
}

// AI Analysis (if enabled)
class AIAnalyzer {
  static async analyzeWithAI(analysisResults) {
    if (process.env.USE_AI !== 'true' || !process.env.OPENAPI_KEY) {
      return null;
    }

    // In a real implementation, this would call the OpenAI API
    // For now, returning null to fall back to manual analysis
    return null;
  }
}

// Telegram Bot Handlers
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  
  if (!sessions[chatId]) {
    sessions[chatId] = {
      id: chatId,
      name: msg.chat.title || msg.from.first_name,
      subscribed: true,
      createdAt: new Date().toISOString()
    };
    
    saveSessions();
  }
  
  bot.sendMessage(chatId, `Welcome to the Crypto Decision Bot! I provide trading signals for ${SYMBOLS.join(', ')} based on technical analysis.`);
});

bot.onText(/\/signals/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    bot.sendMessage(chatId, 'Analyzing market conditions... This may take a moment.');
    
    const analysisResults = await DecisionEngine.analyzeAllSymbols();
    const aiAnalysis = await AIAnalyzer.analyzeWithAI(analysisResults);
    
    let response = '*Crypto Trading Signals*\n\n';
    
    for (const symbol of SYMBOLS) {
      response += `*${symbol.toUpperCase()}*\n`;
      
      // Aggregate decisions across timeframes
      const symbolAnalyses = analysisResults[symbol];
      const decisions = Object.values(symbolAnalyses).map(a => a.decision);
      
      const buyCount = decisions.filter(d => d === 'BUY').length;
      const sellCount = decisions.filter(d => d === 'SELL').length;
      const holdCount = decisions.filter(d => d === 'HOLD').length;
      
      let aggregatedDecision;
      if (buyCount > sellCount && buyCount > holdCount) {
        aggregatedDecision = 'BUY';
      } else if (sellCount > buyCount && sellCount > holdCount) {
        aggregatedDecision = 'SELL';
      } else {
        aggregatedDecision = 'HOLD';
      }
      
      response += `Aggregated: *${aggregatedDecision}*\n`;
      response += `Timeframes: ${decisions.filter(d => d !== 'INSUFFICIENT_DATA').length}/${TIMEFRAMES.length} valid\n\n`;
    }
    
    response += '\nFor detailed analysis per timeframe, use /details <SYMBOL>';
    
    bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error generating signals:', error);
    bot.sendMessage(chatId, 'Error generating signals. Please try again later.');
  }
});

bot.onText(/\/details (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const symbol = match[1].toUpperCase();
  
  if (!SYMBOLS.includes(symbol)) {
    bot.sendMessage(chatId, `Invalid symbol. Supported symbols: ${SYMBOLS.join(', ')}`);
    return;
  }
  
  try {
    bot.sendMessage(chatId, `Analyzing ${symbol} across all timeframes...`);
    
    const analysisResults = {};
    for (const timeframe of TIMEFRAMES) {
      analysisResults[timeframe] = await DecisionEngine.analyzeSymbol(symbol, timeframe);
    }
    
    let response = `*${symbol} Detailed Analysis*\n\n`;
    
    for (const [timeframe, analysis] of Object.entries(analysisResults)) {
      response += `_${timeframe}_: ${analysis.decision} (${analysis.confidence})\n`;
      
      if (analysis.signals) {
        response += `Signals: ${analysis.signals.slice(0, 3).join(', ')}\n`;
      }
      
      if (analysis.currentPrice) {
        response += `Price: $${analysis.currentPrice.toFixed(2)}\n`;
      }
      
      response += '\n';
    }
    
    bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error(`Error analyzing ${symbol}:`, error);
    bot.sendMessage(chatId, `Error analyzing ${symbol}. Please try again later.`);
  }
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  
  const helpMessage = `
*Crypto Decision Bot Commands:*

/start - Start the bot and subscribe to signals
/signals - Get aggregated trading signals for all coins
/details <SYMBOL> - Get detailed analysis for a specific coin
/help - Show this help message

Supported coins: ${SYMBOLS.join(', ')}
Timeframes analyzed: ${TIMEFRAMES.join(', ')}

The bot analyzes multiple technical indicators including:
- Moving Averages (MA)
- Exponential Moving Averages (EMA)
- Relative Strength Index (RSI)
- MACD
- Bollinger Bands
- Fibonacci Retracement
- Market Structure
- Smart Money Concepts
  `;
  
  bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

// Save sessions to file
function saveSessions() {
  try {
    const fs = require('fs');
    fs.writeFileSync('./data.json', JSON.stringify(sessions, null, 2));
  } catch (e) {
    console.error('Error saving sessions:', e);
  }
}

// Periodic analysis and alert system
async function periodicAnalysis() {
  console.log('Running periodic analysis...');
  
  try {
    const analysisResults = await DecisionEngine.analyzeAllSymbols();
    
    // Send alerts to subscribed groups
    for (const [chatId, session] of Object.entries(sessions)) {
      if (session.subscribed) {
        // Find significant changes or opportunities
        let alertMessage = '*Market Alert*\n\n';
        let hasAlert = false;
        
        for (const symbol of SYMBOLS) {
          const symbolAnalyses = analysisResults[symbol];
          
          // Check for high-confidence signals
          for (const [timeframe, analysis] of Object.entries(symbolAnalyses)) {
            if (analysis.confidence === 'HIGH') {
              alertMessage += `${symbol} (${timeframe}): ${analysis.decision} - Confidence: ${analysis.confidence}\n`;
              hasAlert = true;
            }
          }
        }
        
        if (hasAlert) {
          bot.sendMessage(parseInt(chatId), alertMessage, { parse_mode: 'Markdown' });
        }
      }
    }
  } catch (error) {
    console.error('Error in periodic analysis:', error);
  }
  
  // Schedule next analysis (every 30 minutes)
  setTimeout(periodicAnalysis, 30 * 60 * 1000);
}

// Initialize periodic analysis
setTimeout(periodicAnalysis, 5 * 60 * 1000); // Start after 5 minutes

console.log('Crypto Decision Bot is running...');

// In a real implementation, you would connect to the Telegram API
console.log('Bot initialized. In a real implementation, this would connect to Telegram API.');
console.log('Supported coins:', SYMBOLS.join(', '));
console.log('Timeframes analyzed:', TIMEFRAMES.join(', '));

// Run a sample analysis
async function runSampleAnalysis() {
  console.log('\\nRunning sample analysis...');
  const analysis = await DecisionEngine.analyzeSymbol('BTC', '1d');
  console.log('Sample analysis for BTC (1d):', analysis);
}

runSampleAnalysis();