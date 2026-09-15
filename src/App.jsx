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

// API 请求最长等待时间：15 秒
const REQUEST_TIMEOUT = 15 * 1000

// 1 金衡盎司 = 31.1034768 克
const GRAMS_PER_OUNCE = 31.1034768

// =====================================================
// 普通回购价模板
// =====================================================
//
// 黄金：实时价格 - 10 元/克
// 白银：实时价格 - 0.50 元/克
// 铂金：实时价格 - 20 元/克
// 钯金：实时价格 - 25 元/克
//
const NORMAL_BUYBACK_DIFF = {
  gold: 10,
  silver: 0.5,
  platinum: 20,
  palladium: 25,
}

// =====================================================
// 旧料回购模板
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
  // 金属价格
  // ===================================================

  const [metalPrices, setMetalPrices] = useState({
    gold: null,
    silver: null,
    platinum: null,
    palladium: null,
  })

  // ===================================================
  // 汇率
  // ===================================================

  const [exchangeRate, setExchangeRate] = useState(null)

  // ===================================================
  // 页面状态
  // ===================================================

  const [loading, setLoading] = useState(true)

  const [apiError, setApiError] = useState(false)

  const [lastUpdated, setLastUpdated] = useState(null)

  // ===================================================
  // 每个金属单独记录错误
  // ===================================================

  const [metalErrors, setMetalErrors] = useState({
    gold: false,
    silver: false,
    platinum: false,
    palladium: false,
  })

  // ===================================================
  // 请求超时控制
  // ===================================================

  const fetchWithTimeout = async (url) => {
    const controller = new AbortController()

    const timeoutId = setTimeout(() => {
      controller.abort()
    }, REQUEST_TIMEOUT)

    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      })

      return response
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // ===================================================
  // 获取单个贵金属价格
  // ===================================================

  const fetchMetalPrice = async (symbol) => {
    const response = await fetchWithTimeout(
      `${GOLD_API_BASE}/${symbol}`
    )

    if (!response.ok) {
      throw new Error(`${symbol} API 请求失败`)
    }

    const data = await response.json()

    const price = Number(data?.price)

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`${symbol} 返回价格无效`)
    }

    return price
  }

  // ===================================================
  // 获取美元人民币汇率
  // ===================================================

  const fetchExchangeRate = async () => {
    const response = await fetchWithTimeout(
      EXCHANGE_API_URL
    )

    if (!response.ok) {
      throw new Error('美元人民币汇率请求失败')
    }

    const data = await response.json()

    if (data?.result !== 'success') {
      throw new Error('美元人民币汇率接口返回失败')
    }

    const rate = Number(data?.rates?.CNY)

    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error('人民币汇率数据无效')
    }

    return rate
  }

  // ===================================================
  // 更新所有价格
  // ===================================================

  const updatePrices = async () => {
    setLoading(true)

    let successCount = 0

    // ---------------------------------------------------
    // 先获取汇率
    // ---------------------------------------------------

    let usdCny = exchangeRate

    try {
      usdCny = await fetchExchangeRate()

      setExchangeRate(usdCny)
    } catch (error) {
      console.error('汇率获取失败：', error)
    }

    // ---------------------------------------------------
    // 如果汇率失败，而且以前没有成功汇率
    // 就暂时不能计算新的人民币价格
    // ---------------------------------------------------

    if (!usdCny) {
      console.error('没有可用的美元人民币汇率')

      setApiError(true)
      setLoading(false)

      return
    }

    // ---------------------------------------------------
    // 美元/盎司 → 人民币/克
    // ---------------------------------------------------

    const convertToCNYPerGram = (usdPerOunce) => {
      return (
        (usdPerOunce / GRAMS_PER_OUNCE) *
        usdCny
      )
    }

    // ---------------------------------------------------
    // 逐个获取金属
    //
    // 不再使用 Promise.all
    //
    // 一个失败不会影响另外三个
    // ---------------------------------------------------

    const results = {}

    for (const metal of METALS) {
      try {
        const usdPrice = await fetchMetalPrice(
          metal.symbol
        )

        const cnyPrice =
          convertToCNYPerGram(usdPrice)

        if (
          Number.isFinite(cnyPrice) &&
          cnyPrice > 0
        ) {
          results[metal.key] = cnyPrice
          successCount += 1
        }
      } catch (error) {
        console.error(
          `${metal.name}行情获取失败：`,
          error
        )

        results[metal.key] = null
      }
    }

    // ---------------------------------------------------
    // 更新金属错误状态
    // ---------------------------------------------------

    const newMetalErrors = {}

    METALS.forEach((metal) => {
      newMetalErrors[metal.key] =
        results[metal.key] === null
    })

    setMetalErrors(newMetalErrors)

    // ---------------------------------------------------
    // 只更新成功获取到的价格
    //
    // 失败的金属保留原来的价格
    // 不会因为一次 API 波动全部变成 --
    // ---------------------------------------------------

    setMetalPrices((previousPrices) => {
      const newPrices = {
        ...previousPrices,
      }

      METALS.forEach((metal) => {
        if (
          results[metal.key] !== null &&
          results[metal.key] !== undefined
        ) {
          newPrices[metal.key] =
            results[metal.key]
        }
      })

      return newPrices
    })

    // ---------------------------------------------------
    // 只要至少有一个金属成功，就记录更新时间
    // ---------------------------------------------------

    if (successCount > 0) {
      setLastUpdated(new Date())
    }

    // ---------------------------------------------------
    // 错误状态
    // ---------------------------------------------------

    if (successCount === METALS.length) {
      setApiError(false)
    } else {
      setApiError(true)
    }

    setLoading(false)
  }

  // ===================================================
  // 页面加载 + 自动刷新
  // ===================================================

  useEffect(() => {
    updatePrices()

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
      !Number.isFinite(Number(price))
    ) {
      return '--'
    }

    return Number(price).toLocaleString(
      'zh-CN',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )
  }

  // ===================================================
  // 格式化时间
  // ===================================================

  const formatTime = (date) => {
    if (!date) {
      return '--'
    }

    return date.toLocaleTimeString(
      'zh-CN',
      {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }
    )
  }

  // ===================================================
  // 普通回购价
  // ===================================================

  const getNormalBuybackPrice = (key) => {
    const price = metalPrices[key]

    if (
      price === null ||
      price === undefined
    ) {
      return null
    }

    const diff = NORMAL_BUYBACK_DIFF[key]

    return Math.max(price - diff, 0)
  }

  // ===================================================
  // 旧料回购价
  // ===================================================

  const getOldMaterialPrice = (key) => {
    const price = metalPrices[key]

    if (
      price === null ||
      price === undefined
    ) {
      return null
    }

    const rule = OLD_MATERIAL_RULES[key]

    if (rule.type === 'subtract') {
      return Math.max(
        price - rule.value,
        0
      )
    }

    if (rule.type === 'percent') {
      return price * rule.value
    }

    return null
  }

  // ===================================================
  // 旧料回购规则文字
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
              {loading
                ? '正在获取行情'
                : apiError
                ? '部分行情异常'
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
            金属价格
        ================================================= */}

        <section className="metal-grid">

          {METALS.map((metal) => {

            const price =
              metalPrices[metal.key]

            const hasError =
              metalErrors[metal.key]

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
                    {hasError
                      ? '行情获取异常'
                      : '国际现货参考'}
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
                getNormalBuybackPrice(
                  metal.key
                )

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

                    {marketPrice !== null &&
                    marketPrice !== undefined
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
                getOldMaterialPrice(
                  metal.key
                )

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
            自动更新
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
            错误提示
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

                当前部分市场数据暂时无法获取。

                {lastUpdated
                  ? ' 页面继续显示最近一次成功获取的价格。'
                  : ' 请稍后点击重新获取。'}

              </div>

            </div>

            <button
              className="retry-button"
              onClick={updatePrices}
              disabled={loading}
            >
              {loading
                ? '获取中...'
                : '重新获取'}
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
            底部说明
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