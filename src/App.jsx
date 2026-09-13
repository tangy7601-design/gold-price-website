
import { useEffect, useState } from 'react'
import './App.css'

// =====================================================
// API
// =====================================================

// Gold API
// XAU = 黄金
// XAG = 白银
// XPT = 铂金
// XPD = 钯金
const GOLD_API_BASE = 'https://api.gold-api.com/price'

// 美元人民币汇率
const EXCHANGE_API_URL = 'https://open.er-api.com/v6/latest/USD'

// =====================================================
// 基础设置
// =====================================================

// 自动刷新：60 秒
const REFRESH_INTERVAL = 60 * 1000

// 1 金衡盎司 = 31.1034768 克
const GRAMS_PER_OUNCE = 31.1034768

// =====================================================
// 普通回购价模板
// =====================================================
//
// 这里是普通回购参考价。
// 后期可以按照你们实际经营价格自行调整。
//
// 黄金：实时价格 - 10 元/克
// 白银：实时价格 - 0.50 元/克
// 铂金：实时价格 - 20 元/克
// 钯金：实时价格 - 25 元/克
//
// =====================================================

const NORMAL_BUYBACK_DIFF = {
  gold: 10,
  silver: 0.5,
  platinum: 20,
  palladium: 25,
}

// =====================================================
// 旧料回购模板
// =====================================================
//
// 这里只是模板参考价格。
// 实际价格可以根据：
// 成色 / 重量 / 检测结果 / 损耗 / 市场行情
// 进行面议。
//
// 黄金旧料：实时价 - 15 元/克
// 白银旧料：实时价 × 95%
// 铂金旧料：实时价 - 20 元/克
// 钯金旧料：实时价 - 25 元/克
//
// =====================================================

const OLD_MATERIAL_RULES = {
  gold: {
    type: 'subtract',
    value: 15,
  },

  silver: {
    type: 'percent',
    value: 0.95,
  },

  platinum: {
    type: 'subtract',
    value: 20,
  },

  palladium: {
    type: 'subtract',
    value: 25,
  },
}

// =====================================================
// 金属基本信息
// =====================================================

const METALS = [
  {
    key: 'gold',
    symbol: 'XAU',
    name: '黄金',
    english: 'GOLD',
    unit: '元 / 克',
    icon: 'Au',
  },

  {
    key: 'silver',
    symbol: 'XAG',
    name: '白银',
    english: 'SILVER',
    unit: '元 / 克',
    icon: 'Ag',
  },

  {
    key: 'platinum',
    symbol: 'XPT',
    name: '铂金',
    english: 'PLATINUM',
    unit: '元 / 克',
    icon: 'Pt',
  },

  {
    key: 'palladium',
    symbol: 'XPD',
    name: '钯金',
    english: 'PALLADIUM',
    unit: '元 / 克',
    icon: 'Pd',
  },
]

// =====================================================
// App
// =====================================================

function App() {
  // ===================================================
  // State
  // ===================================================

  const [metalPrices, setMetalPrices] = useState({
    gold: null,
    silver: null,
    platinum: null,
    palladium: null,
  })

  const [exchangeRate, setExchangeRate] = useState(null)

  const [loading, setLoading] = useState(true)

  const [apiError, setApiError] = useState(false)

  const [lastUpdated, setLastUpdated] = useState(null)

  // ===================================================
  // 获取单个金属价格
  // ===================================================

  const fetchMetalPrice = async (symbol) => {
    const response = await fetch(
      `${GOLD_API_BASE}/${symbol}`,
      {
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      throw new Error(`${symbol} API 请求失败`)
    }

    const data = await response.json()

    const price = Number(data?.price)

    if (!price || Number.isNaN(price)) {
      throw new Error(`${symbol} 返回价格无效`)
    }

    return price
  }

  // ===================================================
  // 获取美元人民币汇率
  // ===================================================

  const fetchExchangeRate = async () => {
    const response = await fetch(
      EXCHANGE_API_URL,
      {
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      throw new Error('美元人民币汇率请求失败')
    }

    const data = await response.json()

    const rate = Number(data?.rates?.CNY)

    if (!rate || Number.isNaN(rate)) {
      throw new Error('人民币汇率数据无效')
    }

    return rate
  }

  // ===================================================
  // 获取全部行情
  // ===================================================

  const updatePrices = async () => {
    try {
      setLoading(true)

      // 同时请求四种贵金属
      const [goldUSD, silverUSD, platinumUSD, palladiumUSD] =
        await Promise.all([
          fetchMetalPrice('XAU'),
          fetchMetalPrice('XAG'),
          fetchMetalPrice('XPT'),
          fetchMetalPrice('XPD'),
        ])

      // 获取美元人民币汇率
      const usdCny = await fetchExchangeRate()

      // =================================================
      // 国际价格：
      //
      // API：
      // USD / 金衡盎司
      //
      // 转换：
      //
      // USD / 盎司
      // ↓
      // USD / 克
      // ↓
      // CNY / 克
      // =================================================

      const convertToCNYPerGram = (usdPerOunce) => {
        return (
          (usdPerOunce / GRAMS_PER_OUNCE) *
          usdCny
        )
      }

      const prices = {
        gold: convertToCNYPerGram(goldUSD),
        silver: convertToCNYPerGram(silverUSD),
        platinum: convertToCNYPerGram(platinumUSD),
        palladium: convertToCNYPerGram(palladiumUSD),
      }

      // =================================================
      // 保存价格
      // =================================================

      setMetalPrices(prices)

      setExchangeRate(usdCny)

      setLastUpdated(new Date())

      setApiError(false)
    } catch (error) {
      console.error('贵金属行情更新失败：', error)

      // ================================================
      // API 失败：
      //
      // 不清空原来的价格。
      //
      // 如果之前已经获取成功：
      // 继续显示上一次价格。
      //
      // ================================================

      setApiError(true)
    } finally {
      setLoading(false)
    }
  }

  // ===================================================
  // 第一次加载 + 自动刷新
  // ===================================================

  useEffect(() => {
    // 第一次打开页面立即获取
    updatePrices()

    // 每 60 秒更新一次
    const timer = setInterval(() => {
      updatePrices()
    }, REFRESH_INTERVAL)

    return () => {
      clearInterval(timer)
    }
  }, [])

  // ===================================================
  // 格式化价格
  // ===================================================

  const formatPrice = (price) => {
    if (
      price === null ||
      price === undefined ||
      Number.isNaN(price)
    ) {
      return '--'
    }

    return price.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  // ===================================================
  // 格式化更新时间
  // ===================================================

  const formatTime = (date) => {
    if (!date) {
      return '--'
    }

    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  // ===================================================
  // 普通回购价格
  // ===================================================

  const getNormalBuybackPrice = (key) => {
    const price = metalPrices[key]

    if (price === null || price === undefined) {
      return null
    }

    const diff = NORMAL_BUYBACK_DIFF[key]

    return Math.max(price - diff, 0)
  }

  // ===================================================
  // 旧料回购价格
  // ===================================================

  const getOldMaterialPrice = (key) => {
    const price = metalPrices[key]

    if (price === null || price === undefined) {
      return null
    }

    const rule = OLD_MATERIAL_RULES[key]

    if (rule.type === 'subtract') {
      return Math.max(price - rule.value, 0)
    }

    if (rule.type === 'percent') {
      return price * rule.value
    }

    return null
  }

  // ===================================================
  // 旧料规则文字
  // ===================================================

  const getOldMaterialRuleText = (key) => {
    const rule = OLD_MATERIAL_RULES[key]

    if (rule.type === 'subtract') {
      return `参考行情 - ${rule.value} 元/克`
    }

    if (rule.type === 'percent') {
      return `参考行情 × ${rule.value * 100}%`
    }

    return '参考价'
  }

  // ===================================================
  // 页面
  // ===================================================

  return (
    <div className="app">

      {/* =================================================
          顶部
      ================================================= */}

      <header className="header">
        <div className="header-inner">

          <div className="brand">

            <div className="brand-logo">
              PT
            </div>

            <div>
              <div className="brand-name">
                鹏图商贸
              </div>

              <div className="brand-subtitle">
                PRECIOUS METALS · RECOVERY &amp; TRADING
              </div>
            </div>

          </div>

          <div className="header-status">

            <span
              className={`status-dot ${
                apiError
                  ? 'status-error'
                  : 'status-online'
              }`}
            ></span>

            <span>
              {apiError
                ? '行情更新异常'
                : '实时行情'}
            </span>

          </div>

        </div>
      </header>


      {/* =================================================
          主体
      ================================================= */}

      <main className="main">

        {/* =================================================
            Hero
        ================================================= */}

        <section className="hero">

          <div className="hero-label">
            PRECIOUS METALS PRICE
          </div>

          <h1>
            贵金属实时价格
          </h1>

          <p>
            黄金 · 白银 · 铂金 · 钯金
          </p>

        </section>


        {/* =================================================
            四种贵金属行情
        ================================================= */}

        <section className="metal-grid">

          {METALS.map((metal) => {

            const price =
              metalPrices[metal.key]

            return (
              <div
                className={`metal-card metal-${metal.key}`}
                key={metal.key}
              >

                <div className="metal-card-top">

                  <div>

                    <div className="metal-name">
                      {metal.name}
                    </div>

                    <div className="metal-en">
                      {metal.english}
                    </div>

                  </div>

                  <div className="metal-symbol">
                    {metal.icon}
                  </div>

                </div>


                <div className="metal-price">
                  ¥{formatPrice(price)}
                </div>


                <div className="metal-unit">
                  {metal.unit}
                </div>


                <div className="metal-card-bottom">

                  <span>
                    {metal.symbol}
                  </span>

                  <span>
                    国际现货参考
                  </span>

                </div>

              </div>
            )
          })}

        </section>


        {/* =================================================
            普通回购
        ================================================= */}

        <section className="section-block">

          <div className="section-heading">

            <div>

              <div className="section-title">
                普通回购
              </div>

              <div className="section-subtitle">
                STANDARD BUYBACK
              </div>

            </div>

            <div className="section-note">
              参考价
            </div>

          </div>


          <div className="buyback-grid">

            {METALS.map((metal) => {

              const marketPrice =
                metalPrices[metal.key]

              const buybackPrice =
                getNormalBuybackPrice(metal.key)

              return (
                <div
                  className="buyback-item"
                  key={metal.key}
                >

                  <div className="buyback-name">
                    {metal.name}
                  </div>

                  <div className="buyback-price">
                    ¥{formatPrice(buybackPrice)}
                    <span>
                      / 克
                    </span>
                  </div>

                  <div className="buyback-formula">
                    {marketPrice !== null
                      ? `实时价 - ${NORMAL_BUYBACK_DIFF[metal.key]} 元`
                      : '等待行情'}
                  </div>

                </div>
              )
            })}

          </div>

        </section>


        {/* =================================================
            旧料回购
        ================================================= */}

        <section className="old-material-section">

          <div className="old-material-header">

            <div>

              <div className="old-material-title">
                旧料回购
              </div>

              <div className="old-material-subtitle">
                OLD MATERIAL RECOVERY
              </div>

            </div>

            <div className="old-material-badge">
              面议为准
            </div>

          </div>


          <div className="old-material-grid">

            {METALS.map((metal) => {

              const oldPrice =
                getOldMaterialPrice(metal.key)

              return (
                <div
                  className="old-material-card"
                  key={metal.key}
                >

                  <div className="old-material-top">

                    <div className="old-material-name">
                      {metal.name}旧料
                    </div>

                    <div className="old-material-symbol">
                      {metal.icon}
                    </div>

                  </div>


                  <div className="old-material-price">
                    ¥{formatPrice(oldPrice)}
                    <span>
                      / 克
                    </span>
                  </div>


                  <div className="old-material-rule">
                    {getOldMaterialRuleText(
                      metal.key
                    )}
                  </div>

                </div>
              )
            })}

          </div>


          <div className="old-material-notice">

            <div className="old-notice-icon">
              !
            </div>

            <div>

              <div className="old-notice-title">
                旧料回购价格仅供参考
              </div>

              <div className="old-notice-text">
                实际回收价格将根据材质、成色、
                重量、检测结果、损耗及实时市场行情综合评估，
                最终价格以现场检测及双方协商为准。
              </div>

            </div>

          </div>

        </section>


        {/* =================================================
            行情数据
        ================================================= */}

        <section className="market-info">

          <div className="market-title">

            <span>
              行情数据
            </span>

            <span className="market-title-en">
              MARKET DATA
            </span>

          </div>


          <div className="market-grid">

            <div className="market-item">

              <div className="market-item-label">
                美元人民币
              </div>

              <div className="market-item-value">
                {exchangeRate !== null
                  ? formatPrice(exchangeRate)
                  : '--'}
              </div>

              <div className="market-item-desc">
                USD / CNY
              </div>

            </div>


            <div className="market-item">

              <div className="market-item-label">
                计价单位
              </div>

              <div className="market-item-value">
                克
              </div>

              <div className="market-item-desc">
                CNY / GRAM
              </div>

            </div>


            <div className="market-item">

              <div className="market-item-label">
                更新周期
              </div>

              <div className="market-item-value">
                60秒
              </div>

              <div className="market-item-desc">
                AUTO REFRESH
              </div>

            </div>

          </div>

        </section>


        {/* =================================================
            更新时间
        ================================================= */}

        <section className="update-panel">

          <div className="update-left">

            <div className="update-icon">
              ↻
            </div>

            <div>

              <div className="update-title">
                行情自动更新
              </div>

              <div className="update-desc">
                系统每 60 秒自动获取最新市场数据
              </div>

            </div>

          </div>


          <div className="update-time">

            <div className="update-time-label">
              最后成功更新时间
            </div>

            <div className="update-time-value">
              {formatTime(lastUpdated)}
            </div>

          </div>

        </section>


        {/* =================================================
            API 错误
        ================================================= */}

        {apiError && (

          <section className="error-panel">

            <div className="error-icon">
              !
            </div>

            <div className="error-content">

              <div className="error-title">
                行情更新暂时异常
              </div>

              <div className="error-text">
                当前无法获取部分最新市场数据。
                {lastUpdated
                  ? ' 页面继续显示上一次成功获取的价格。'
                  : ' 请稍后刷新页面重试。'}
              </div>

            </div>

            <button
              className="retry-button"
              onClick={updatePrices}
            >
              重新获取
            </button>

          </section>

        )}


        {/* =================================================
            公司信息
        ================================================= */}

        <section className="company-card">

          <div className="company-main">

            <div className="company-mark">
              PT
            </div>

            <div>

              <div className="company-name">
                鹏图商贸
              </div>

              <div className="company-desc">
                黄金回收 · 贵金属回收 · 旧料回购 · 贵金属交易
              </div>

            </div>

          </div>


          <a
            href="tel:15398755989"
            className="phone-button"
          >
            <span>
              ☎
            </span>

            15398755989
          </a>

        </section>


        {/* =================================================
            最终说明
        ================================================= */}

        <div className="notice">

          <span>
            ⓘ
          </span>

          <p>
            以上贵金属价格根据国际市场行情及汇率换算，
            仅作为交易参考。实际交易价格可能因市场波动、
            材质、纯度、重量、成色、检测结果及具体交易情况而调整。
            旧料回购价格以现场检测及双方协商结果为准。
          </p>

        </div>

      </main>


      {/* =================================================
          Footer
      ================================================= */}

      <footer className="footer">

        <div>
          鹏图商贸 · 贵金属回收报价
        </div>

        <div>
          实时行情仅供参考 · 价格以实际面议为准
        </div>

      </footer>

    </div>
  )
}

export default App
