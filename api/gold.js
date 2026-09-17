export default async function handler(req, res) {
  // =====================================================
  // CORS
  // =====================================================

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // 浏览器的预检请求
  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  // 只允许 GET
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    })
  }

  try {
    // =====================================================
    // 上海黄金交易所 Au99.99
    // =====================================================

    const response = await fetch(
      'https://www.sge.com.cn/graph/Dailyhq',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'instid=Au99.99'
      }
    )

    if (!response.ok) {
      throw new Error(
        `Shanghai Gold Exchange HTTP ${response.status}`
      )
    }

    const text = await response.text()

    // =====================================================
    // 尝试解析返回数据
    // =====================================================

    let data

    try {
      data = JSON.parse(text)
    } catch {
      throw new Error('上海黄金交易所返回的数据不是有效 JSON')
    }

    // =====================================================
    // 找到最新的一条数据
    // =====================================================

    let latestRecord = null

    if (Array.isArray(data)) {
      latestRecord = data[data.length - 1]
    } else if (Array.isArray(data?.data)) {
      latestRecord = data.data[data.data.length - 1]
    } else if (Array.isArray(data?.result)) {
      latestRecord = data.result[data.result.length - 1]
    } else if (Array.isArray(data?.rows)) {
      latestRecord = data.rows[data.rows.length - 1]
    }

    if (!latestRecord) {
      throw new Error('没有找到 Au99.99 最新数据')
    }

    // =====================================================
    // 提取数字
    // =====================================================

    let values = []

    if (Array.isArray(latestRecord)) {
      values = latestRecord
    } else if (typeof latestRecord === 'object') {
      values = Object.values(latestRecord)
    } else {
      values = [latestRecord]
    }

    const numbers = values
      .map((value) => {
        if (typeof value === 'number') {
          return value
        }

        if (typeof value === 'string') {
          const match = value.match(
            /-?\d+(?:\.\d+)/
          )

          return match ? Number(match[0]) : NaN
        }

        return NaN
      })
      .filter((value) => Number.isFinite(value))

    if (numbers.length === 0) {
      throw new Error('无法从上海黄金交易所数据中提取价格')
    }

    // 使用最新记录中的最后一个有效数字
    const price = numbers[numbers.length - 1]

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error('Au99.99 黄金价格无效')
    }

    // =====================================================
    // 日期
    // =====================================================

    let date = new Date()
      .toISOString()
      .slice(0, 10)

    if (Array.isArray(latestRecord)) {
      const possibleDate = latestRecord.find(
        (value) =>
          typeof value === 'string' &&
          /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(value)
      )

      if (possibleDate) {
        date = possibleDate.replace(/\//g, '-')
      }
    }

    // =====================================================
    // 返回给前端
    // =====================================================

    return res.status(200).json({
      success: true,
      source: 'Shanghai Gold Exchange',
      product: 'Au99.99',
      currency: 'CNY',
      unit: 'RMB/gram',
      price: Number(price),
      date,
      updatedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error(
      'Gold API Error:',
      error
    )

    return res.status(500).json({
      success: false,
      error: error.message || '黄金价格获取失败'
    })
  }
}