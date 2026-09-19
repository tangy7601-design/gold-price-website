import { useEffect, useState } from 'react'
import './App.css'

// =====================================================
// API
// =====================================================

// 上海黄金交易所 Au99.99
//
// 本地开发：直接访问已经部署好的 Vercel API
// 正式网站：使用当前网站自己的 /api/gold
const GOLD_API_URL = import.meta.env.DEV
  ? 'https://gold-price-website-nine.vercel.app/api/gold'
  : '/api/gold'

// Gold API
// XAG = 白银
// XPT = 铂金
// XPD = 钯金
const GOLD_API_BASE = 'https://api.gold-api.com/price'

// 美元人民币汇率
const EXCHANGE_API_URL =
  'https://open.er-api.com/v6/latest/USD'

// =====================================================
// 基础设置
// =====================================================

const REFRESH_INTERVAL = 60 * 1000

const REQUEST_TIMEOUT = 15 * 1000

// 1 金衡盎司 = 31.1034768 克
const GRAMS_PER_OUNCE = 31.1034768

// =====================================================
// 普通回购价
// =====================================================

const NORMAL_BUYBACK_DIFF = {
  gold: 10,
  silver: 0.5,
  platinum: 20,
  palladium: 25,
}

// =====================================================
// 旧料回购规则
// =====================================================
//
// 黄金：
// 金条   = 黄金 - 12
// 万足金 = 黄金 - 14
// 千足金 = 黄金 - 16
// 22K    = 黄金 × 88%
// 18K    = 黄金 × 73%
// 14K    = 黄金 × 55%
// 9K     = 黄金 × 35%
//
// 铂金：
// PT950 = 铂金 - 20
// PT990 = 铂金 - 15
// PT999 = 铂金 - 12
//
// 钯金：
// PD950 = 钯金 - 25
// PD990 = 钯金 - 20
// PD999 = 钯金 - 18
// =====================================================

const OLD_MATERIALS = {
  gold: [
    {
      name: '金条',
      symbol: 'Au',
      type: 'subtract',
      value: 12,
      ruleText: '参考行情 - 12 元/克',
    },
    {
      name: '万足金',
      symbol: 'Au',
      type: 'subtract',
      value: 14,
      ruleText: '参考行情 - 14 元/克',
    },
    {
      name: '千足金',
      symbol: 'Au',
      type: 'subtract',
      value: 16,
      ruleText: '参考行情 - 16 元/克',
    },
    {
      name: '22K',
      symbol: 'Au',
      type: 'percent',
      value: 0.88,
      ruleText: '参考行情 × 88%',
    },
    {
      name: '18K',
      symbol: 'Au',
      type: 'percent',
      value: 0.73,
      ruleText: '参考行情 × 73%',
    },
    {
      name: '14K',
      symbol: 'Au',
      type: 'percent',
      value: 0.55,
      ruleText: '参考行情 × 55%',
    },
    {
      name: '9K',
      symbol: 'Au',
      type: 'percent',
      value: 0.35,
      ruleText: '参考行情 × 35%',
    },
  ],

  platinum: [
    {
      name: 'PT950',
      symbol: 'Pt',
      type: 'subtract',
      value: 20,
      ruleText: '参考行情 - 20 元/克',
    },
    {
      name: 'PT990',
      symbol: 'Pt',
      type: 'subtract',
      value: 15,
      ruleText: '参考行情 - 15 元/克',
    },
    {
      name: 'PT999',
      symbol: 'Pt',
      type: 'subtract',
      value: 12,
      ruleText: '参考行情 - 12 元/克',
    },
  ],

  palladium: [
    {
      name: 'PD950',
      symbol: 'Pd',
      type: 'subtract',
      value: 25,
      ruleText: '参考行情 - 25 元/克',
    },
    {
      name: 'PD990',
      symbol: 'Pd',
      type: 'subtract',
      value: 20,
      ruleText: '参考行情 - 20 元/克',
    },
    {
      name: 'PD999',
      symbol: 'Pd',
      type: 'subtract',
      value: 18,
      ruleText: '参考行情 - 18 元/克',
    },
  ],
}

// =====================================================
// 四大贵金属
// =====================================================

const METALS = [
  {
    key: 'gold',
    symbol: 'Au99.99',
    name: '黄金',
    english: 'GOLD',
    icon: 'Au',
    source: '上海黄金交易所',
  },
  {
    key: 'silver',
    symbol: 'XAG',
    name: '白银',
    english: 'SILVER',
    icon: 'Ag',
    source: 'Gold API',
  },
  {
    key: 'platinum',
    symbol: 'XPT',
    name: '铂金',
    english: 'PLATINUM',
    icon: 'Pt',
    source: 'Gold API',
  },
  {
    key: 'palladium',
    symbol: 'XPD',
    name: '钯金',
    english: 'PALLADIUM',
    icon: 'Pd',
    source: 'Gold API',
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
  // 黄金 API 信息
  // ===================================================

  const [goldDate, setGoldDate] = useState(null)

  // ===================================================
  // 汇率
  // ===================================================

  const [exchangeRate, setExchangeRate] = useState(null)

  // ===================================================
  // 页面状态
  // ===================================================

  const [loading, setLoading] = useState(true)

  const [refreshing, setRefreshing] = useState(false)

  const [apiError, setApiError] = useState(false)

  const [lastUpdated, setLastUpdated] = useState(null)

  // ===================================================
  // 各金属错误状态
  // ===================================================

  const [metalErrors, setMetalErrors] = useState({
    gold: false,
    silver: false,
    platinum: false,
    palladium: false,
  })

  // ===================================================
  // 请求超时
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
  // 获取黄金价格
  // ===================================================

  const fetchGoldPrice = async () => {
    const response = await fetchWithTimeout(
      GOLD_API_URL
    )

    if (!response.ok) {
      throw new Error(
        `黄金 API 请求失败：HTTP ${response.status}`
      )
    }

    const data = await response.json()

    const price = Number(data?.price)

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      throw new Error(
        '上海黄金交易所黄金价格无效'
      )
    }

    return {
      price,
      date: data?.date || null,
    }
  }

  // ===================================================
  // 获取国际贵金属价格
  // ===================================================

  const fetchMetalPrice = async (symbol) => {
    const response = await fetchWithTimeout(
      `${GOLD_API_BASE}/${symbol}`
    )

    if (!response.ok) {
      throw new Error(
        `${symbol} API 请求失败`
      )
    }

    const data = await response.json()

    const price = Number(data?.price)

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      throw new Error(
        `${symbol} API 返回价格无效`
      )
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
      throw new Error(
        `汇率 API 请求失败：HTTP ${response.status}`
      )
    }

    const data = await response.json()

    const rate = Number(
      data?.rates?.CNY
    )

    if (
      !Number.isFinite(rate) ||
      rate <= 0
    ) {
      throw new Error(
        'USD/CNY 汇率无效'
      )
    }

    return rate
  }

  // ===================================================
  // USD / 金衡盎司
  // → CNY / 克
  // ===================================================

  const usdOunceToCnyGram = (
    usdPerOunce,
    usdCny
  ) => {
    return (
      usdPerOunce *
      usdCny /
      GRAMS_PER_OUNCE
    )
  }

  // ===================================================
  // 刷新全部价格
  // ===================================================

  const updatePrices = async () => {
    if (refreshing) {
      return
    }

    setRefreshing(true)

    // -----------------------------------------------
    // 记录这次请求开始前的旧价格
    // -----------------------------------------------

    const previousPrices = {
      ...metalPrices,
    }

    let successCount = 0

    const newErrors = {
      gold: false,
      silver: false,
      platinum: false,
      palladium: false,
    }

    let newExchangeRate =
      exchangeRate

    try {
      // =================================================
      // 黄金
      // =================================================

      try {
        const goldResult =
          await fetchGoldPrice()

        setMetalPrices((previous) => ({
          ...previous,
          gold: goldResult.price,
        }))

        setGoldDate(
          goldResult.date
        )

        successCount += 1
      } catch (error) {
        console.error(
          'Gold price error:',
          error
        )

        newErrors.gold = true
      }

      // =================================================
      // 汇率
      // =================================================

      try {
        newExchangeRate =
          await fetchExchangeRate()

        setExchangeRate(
          newExchangeRate
        )
      } catch (error) {
        console.error(
          'Exchange rate error:',
          error
        )

        newExchangeRate =
          exchangeRate
      }

      // =================================================
      // 白银 / 铂金 / 钯金
      // =================================================

      const internationalResults =
        await Promise.allSettled([
          fetchMetalPrice('XAG'),
          fetchMetalPrice('XPT'),
          fetchMetalPrice('XPD'),
        ])

      const symbols = [
        'silver',
        'platinum',
        'palladium',
      ]

      internationalResults.forEach(
        (result, index) => {
          const key = symbols[index]

          if (
            result.status === 'fulfilled' &&
            Number.isFinite(
              Number(result.value)
            ) &&
            Number(result.value) > 0 &&
            Number.isFinite(
              Number(newExchangeRate)
            )
          ) {
            const cnyPerGram =
              usdOunceToCnyGram(
                Number(result.value),
                Number(newExchangeRate)
              )

            setMetalPrices(
              (previous) => ({
                ...previous,
                [key]: cnyPerGram,
              })
            )

            successCount += 1
          } else {
            newErrors[key] = true
          }
        }
      )

      // =================================================
      // 如果某些请求失败
      // 就继续使用之前成功的价格
      // =================================================

      setMetalPrices((previous) => {
        const result = {
          ...previous,
        }

        Object.keys(previousPrices)
          .forEach((key) => {
            if (
              result[key] === null &&
              previousPrices[key] !== null
            ) {
              result[key] =
                previousPrices[key]
            }
          })

        return result
      })

      // =================================================
      // 错误状态
      // =================================================

      setMetalErrors(
        newErrors
      )

      setApiError(
        Object.values(newErrors)
          .some(Boolean)
      )

      // =================================================
      // 只要有价格成功获取
      // 就更新页面更新时间
      // =================================================

      if (successCount > 0) {
        setLastUpdated(
          new Date()
        )
      }
    } catch (error) {
      console.error(
        'Update prices error:',
        error
      )

      setApiError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // ===================================================
  // 页面加载 + 60 秒自动刷新
  // ===================================================

  useEffect(() => {
    updatePrices()

    const timer =
      setInterval(
        () => {
          updatePrices()
        },
        REFRESH_INTERVAL
      )

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
      !Number.isFinite(
        Number(price)
      )
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

  const getNormalBuybackPrice = (
    key
  ) => {
    const price =
      metalPrices[key]

    if (
      price === null ||
      price === undefined
    ) {
      return null
    }

    const diff =
      NORMAL_BUYBACK_DIFF[key]

    return Math.max(
      Number(price) - diff,
      0
    )
  }

  // ===================================================
  // 旧料价格计算
  // ===================================================

  const calculateOldPrice = (
    marketPrice,
    rule
  ) => {
    if (
      marketPrice === null ||
      marketPrice === undefined ||
      !rule
    ) {
      return null
    }

    if (rule.type === 'subtract') {
      return Math.max(
        Number(marketPrice) -
          rule.value,
        0
      )
    }

    if (rule.type === 'percent') {
      return (
        Number(marketPrice) *
        rule.value
      )
    }

    return null
  }

  // ===================================================
  // 黄金旧料
  // ===================================================

  const goldOldPriceCards =
    OLD_MATERIALS.gold

  // ===================================================
  // 铂金旧料
  // ===================================================

  const platinumOldPriceCards =
    OLD_MATERIALS.platinum

  // ===================================================
  // 钯金旧料
  // ===================================================

  const palladiumOldPriceCards =
    OLD_MATERIALS.palladium

  // ===================================================
  // 黄金交易状态
  // ===================================================
  //
  // 按上海时间判断：
  //
  // 周一至周五：
  // 09:00 - 15:30
  // 20:00 - 次日 02:30
  //
  // 周末：
  // 非交易时间
  // ===================================================

  const getGoldTradingStatus = () => {
    const now =
      new Date()

    const parts =
      new Intl.DateTimeFormat(
        'en-US',
        {
          timeZone:
            'Asia/Shanghai',
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }
      ).formatToParts(now)

    const values = {}

    parts.forEach((part) => {
      if (
        part.type !== 'literal'
      ) {
        values[part.type] =
          part.value
      }
    })

    const weekday =
      values.weekday

    let hour =
      Number(values.hour)

    const minute =
      Number(values.minute)

    if (hour === 24) {
      hour = 0
    }

    const totalMinutes =
      hour * 60 + minute

    const weekend =
      weekday === 'Sat' ||
      weekday === 'Sun'

    if (weekend) {
      return {
        active: false,
        text: '非交易时间',
      }
    }

    const daytime =
      totalMinutes >= 9 * 60 &&
      totalMinutes <=
        15 * 60 + 30

    const nighttime =
      totalMinutes >=
        20 * 60 ||
      totalMinutes <=
        2 * 60 + 30

    if (
      daytime ||
      nighttime
    ) {
      return {
        active: true,
        text: '交易中',
      }
    }

    return {
      active: false,
      text: '非交易时间',
    }
  }

  const goldTradingStatus =
    getGoldTradingStatus()

  // ===================================================
  // 页面
  // ===================================================

  return (
    <div className="app">

      {/* =================================================
          Header
      ================================================= */}

      <header className="header">

        <div className="header-inner">

          <div className="brand">

            <div className="brand-logo">
              鹏
            </div>

            <div>

              <div className="brand-name">
                鹏图商贸
              </div>

              <div className="brand-subtitle">
                贵金属回收 · 实时行情
              </div>

            </div>

          </div>

          <div className="header-status">

            <span
              className={
                goldTradingStatus.active
                  ? 'status-dot active'
                  : 'status-dot'
              }
            />

            <span>
              {goldTradingStatus.active
                ? '实时行情'
                : '非交易时间'}
            </span>

          </div>

        </div>

      </header>


      {/* =================================================
          Main
      ================================================= */}

      <main className="main">


        {/* =================================================
            Hero
        ================================================= */}

        <section className="hero">

          <div>

            <div className="hero-label">
              PRECIOUS METAL MARKET
            </div>

            <h1 className="hero-title">
              贵金属实时行情
            </h1>

            <p className="hero-subtitle">
              国际市场价格换算 · 每60秒自动更新
            </p>

          </div>

          <button
            className="hero-refresh"
            onClick={updatePrices}
            disabled={refreshing}
          >
            {refreshing
              ? '更新中...'
              : '刷新价格'}
          </button>

        </section>


        {/* =================================================
            四大贵金属
        ================================================= */}

        <section className="metal-grid">

          {METALS.map((metal) => {

            const price =
              metalPrices[metal.key]

            const isGold =
              metal.key === 'gold'

            return (
              <div
                className={`metal-card metal-${metal.key}`}
                key={metal.key}
              >

                <div className="metal-card-top">

                  <div>

                    <div className="metal-en">
                      {metal.english}
                    </div>

                    <div className="metal-name">
                      {metal.name}
                    </div>

                  </div>

                  <div className="metal-symbol">
                    {metal.symbol}
                  </div>

                </div>


                <div className="metal-price">
                  ¥{formatPrice(price)}
                </div>

                <div className="metal-unit">
                  元 / 克
                </div>


                {isGold && (
                  <div className="gold-trading-mini">

                    <span
                      className={
                        goldTradingStatus.active
                          ? 'trading-dot active'
                          : 'trading-dot'
                      }
                    />

                    <span>
                      {goldTradingStatus.text}
                    </span>

                  </div>
                )}


                <div className="metal-card-bottom">

                  {isGold
                    ? `数据来源：${metal.source} · ${goldDate || '最新数据'}`
                    : `数据来源：${metal.source}`}

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

                    ¥{formatPrice(
                      buybackPrice
                    )}

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


          {/* ================= 黄金旧料 ================= */}

          <div className="old-group">

            <div className="old-group-title">

              <span>
                黄金旧料
              </span>

              <small>
                Au
              </small>

            </div>


            <div className="old-material-grid">

              {goldOldPriceCards.map(
                (item) => {

                  const price =
                    calculateOldPrice(
                      metalPrices.gold,
                      item
                    )

                  return (
                    <div
                      className="old-material-card"
                      key={item.name}
                    >

                      <div className="old-material-top">

                        <div className="old-material-name">
                          {item.name}
                        </div>

                        <div className="old-material-symbol">
                          {item.symbol}
                        </div>

                      </div>

                      <div className="old-material-price">

                        ¥{formatPrice(price)}

                        <span>
                          / 克
                        </span>

                      </div>

                      <div className="old-material-rule">
                        {item.ruleText}
                      </div>

                    </div>
                  )
                }
              )}

            </div>

          </div>


          {/* ================= 铂金旧料 ================= */}

          <div className="old-group">

            <div className="old-group-title">

              <span>
                铂金旧料
              </span>

              <small>
                Pt
              </small>

            </div>


            <div className="old-material-grid">

              {platinumOldPriceCards.map(
                (item) => {

                  const price =
                    calculateOldPrice(
                      metalPrices.platinum,
                      item
                    )

                  return (
                    <div
                      className="old-material-card"
                      key={item.name}
                    >

                      <div className="old-material-top">

                        <div className="old-material-name">
                          {item.name}
                        </div>

                        <div className="old-material-symbol">
                          {item.symbol}
                        </div>

                      </div>

                      <div className="old-material-price">

                        ¥{formatPrice(price)}

                        <span>
                          / 克
                        </span>

                      </div>

                      <div className="old-material-rule">
                        {item.ruleText}
                      </div>

                    </div>
                  )
                }
              )}

            </div>

          </div>


          {/* ================= 钯金旧料 ================= */}

          <div className="old-group">

            <div className="old-group-title">

              <span>
                钯金旧料
              </span>

              <small>
                Pd
              </small>

            </div>


            <div className="old-material-grid">

              {palladiumOldPriceCards.map(
                (item) => {

                  const price =
                    calculateOldPrice(
                      metalPrices.palladium,
                      item
                    )

                  return (
                    <div
                      className="old-material-card"
                      key={item.name}
                    >

                      <div className="old-material-top">

                        <div className="old-material-name">
                          {item.name}
                        </div>

                        <div className="old-material-symbol">
                          {item.symbol}
                        </div>

                      </div>

                      <div className="old-material-price">

                        ¥{formatPrice(price)}

                        <span>
                          / 克
                        </span>

                      </div>

                      <div className="old-material-rule">
                        {item.ruleText}
                      </div>

                    </div>
                  )
                }
              )}

            </div>

          </div>


          {/* =================================================
              旧料说明
          ================================================= */}

          <div className="old-material-notice">

            <div className="old-notice-icon">
              !
            </div>

            <div>

              <div className="old-notice-title">
                旧料回购价格仅供参考
              </div>

              <div className="old-notice-text">
                实际回收价格将根据材质、成色、重量、检测结果、损耗及实时市场行情综合评估，最终价格以现场检测及双方协商为准。
              </div>

            </div>

          </div>

        </section>


        {/* =================================================
            行情数据
        ================================================= */}

        <section className="market-info">

          <div className="market-header">

            <div>

              <div className="market-title">
                行情数据
              </div>

              <div className="market-subtitle">
                MARKET DATA
              </div>

            </div>

          </div>


          <div className="market-grid">

            <div className="market-item">

              <span>
                美元人民币
              </span>

              <strong>
                {exchangeRate
                  ? Number(
                      exchangeRate
                    ).toFixed(4)
                  : '--'}
              </strong>

              <small>
                USD / CNY
              </small>

            </div>


            <div className="market-item">

              <span>
                计价单位
              </span>

              <strong>
                克
              </strong>

              <small>
                CNY / GRAM
              </small>

            </div>


            <div className="market-item">

              <span>
                更新周期
              </span>

              <strong>
                60秒
              </strong>

              <small>
                AUTO REFRESH
              </small>

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
                系统每 60 秒自动获取最新市场行情
              </div>

              <div className="update-time">
                最近更新：
                {formatTime(
                  lastUpdated
                )}
              </div>

            </div>

          </div>


          <button
            className="retry-button"
            onClick={updatePrices}
            disabled={refreshing}
          >
            {refreshing
              ? '更新中...'
              : '立即更新'}
          </button>

        </section>


        {/* =================================================
            API 异常提示
        ================================================= */}

        {apiError && (
          <div className="error-panel">

            当前部分市场数据暂时无法获取。
            页面继续显示最近一次成功获取的价格。

          </div>
        )}


        {/* =================================================
            公司信息
        ================================================= */}

        <section className="company-card">

          <div className="company-main">

            <div className="company-mark">
              鹏
            </div>

            <div>

              <div className="company-label">
                回收咨询
              </div>

              <div className="company-name">
                鹏图商贸
              </div>

              <div className="company-desc">
                专业贵金属回收 · 价格透明 · 实时行情
              </div>

            </div>

          </div>


          <a
            className="phone-button"
            href="tel:15398755989"
          >
            ☎ 15398755989
          </a>

        </section>


        {/* =================================================
            价格说明
        ================================================= */}

        <section className="notice">

          <div className="notice-title">
            价格说明
          </div>

          <div className="notice-text">
            以上价格仅供参考，实际回购价格根据当日市场行情、贵金属成色、重量及检测结果综合确定，具体价格以实物检测及双方协商为准。
          </div>

        </section>

      </main>


      {/* =================================================
          Footer
      ================================================= */}

      <footer className="footer">

        <div>
          © 2026 鹏图商贸
        </div>

        <div>
          贵金属行情仅供参考
        </div>

      </footer>

    </div>
  )
}

export default App