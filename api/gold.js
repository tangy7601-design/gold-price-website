export default async function handler(req, res) {
  // =====================================================
  // CORS
  // =====================================================

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // 浏览器预检
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
    // 请求上海黄金交易所
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

    if (!response.ok) {
      throw new Error(
        `Shanghai Gold Exchange HTTP ${response.status}`
      )
    }

    // =====================================================
    // 获取原始返回内容
    // =====================================================

    const text = await response.text()

    console.log('==============================')
    console.log('SGE STATUS:', response.status)
    console.log('SGE RAW RESPONSE:')
    console.log(text)
    console.log('==============================')

    // =====================================================
    // 临时诊断
    // 直接把 SGE 原始数据返回给浏览器
    // =====================================================

    return res.status(200).json({
      success: false,
      debug: true,
      message: '已经成功连接上海黄金交易所，下面是原始返回数据',
      raw: text
    })

  } catch (error) {
    // =====================================================
    // 错误处理
    // =====================================================

    console.error('Gold API Error:', error)

    return res.status(500).json({
      success: false,
      error: error.message || '黄金价格获取失败'
    })
  }
}