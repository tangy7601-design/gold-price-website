export default async function handler(req, res) {
  // =====================================================
  // CORS
  // =====================================================

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // 浏览器预检请求
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
    // 上海黄金交易所
    // Au99.99
    // =====================================================

    const response = await fetch(
      'https://www.sge.com.cn/graph/Dailyhq',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0'
        },

        body: 'instid=Au99.99'
      }
    )

    // =====================================================
    // 检查请求是否成功
    // =====================================================

    if (!response.ok) {
      throw new Error(
        `Shanghai Gold Exchange HTTP ${response.status}`
      )
    }

    // =====================================================
    // 获取原始文本
    // =====================================================

    const text = await response.text()

    // =====================================================
    // 解析 JSON
    // =====================================================

    let data

    try {
      data = JSON.parse(text)
    } catch {
      throw new Error(
        '上海黄金交易所返回的数据不是有效 JSON'
      )
    }

    // =====================================================
    // SGE 实际返回结构：
    //
    // {
    //   "time": [
    //     ["日期", 数字, 数字, 数字, 数字],
    //     ...
    //   ]
    // }
    //
    // 所以真正的数据在 data.time
    // =====================================================

    if (
      !data ||
      !Array.isArray(data.time) ||
      data.time.length === 0
    ) {
      throw new Error(
        '上海黄金交易所没有返回有效的 Au99.99 数据'
      )
    }

    // =====================================================
    // 获取最后一条记录
    //
    // 例如：
    //
    // [
    //   "2026-09-18",
    //   937.0,
    //   947.09,
    //   935.5,
    //   948.9
    // ]
    // =====================================================

    const latestRecord =
      data.time[data.time.length - 1]

    // =====================================================
    // 检查最新记录
    // =====================================================

    if (
      !Array.isArray(latestRecord) ||
      latestRecord.length < 2
    ) {
      throw new Error(
        '上海黄金交易所最新记录格式异常'
      )
    }

    // =====================================================
    // 第一项 = 日期
    // 最后一项 = 当前这条记录中的价格字段
    // =====================================================

    const date = String(
      latestRecord[0]
    )

    const price = Number(
      latestRecord[latestRecord.length - 1]
    )

    // =====================================================
    // 检查价格
    // =====================================================

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      throw new Error(
        'Au99.99 黄金价格无效'
      )
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

      price: price,

      date: date,

      updatedAt: new Date().toISOString()
    })

  } catch (error) {

    // =====================================================
    // 错误处理
    // =====================================================

    console.error(
      'Gold API Error:',
      error
    )

    return res.status(500).json({
      success: false,

      error:
        error.message ||
        '黄金价格获取失败'
    })
  }
}